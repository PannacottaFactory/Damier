import { BEATS_PER_BAR, STEPS_PER_BEAT } from '../config';
import type { TempoMap } from '../core/clock';
import {
  advanceBar,
  chordIndexAt,
  nextSectionStart,
  SONG_START,
  type SongPosition,
  sectionOf,
} from './arrangement';
import type { Mixer } from './mixer';
import {
  arpNote,
  bassNote,
  type NoteEvent,
  parseNotes,
  parsePattern,
  type Section,
  type Song,
  type Track,
  trackBar,
} from './songs/types';
import { playBass } from './synth/bass';
import { playCrash, playRiser } from './synth/fx';
import { Hats } from './synth/hat';
import { playKick } from './synth/kick';
import { playLead } from './synth/lead';
import { playSnare } from './synth/snare';
import type { EventTimeline } from './timeline';

const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR;

/**
 * Séquenceur pas-à-pas : pour chaque double croche planifiée par le Scheduler,
 * avance dans la structure du morceau, déclenche les instruments à la date exacte
 * et note les événements dans la timeline (synchro visuelle + gameplay).
 */
export class Sequencer {
  private song: Song;
  private pos: SongPosition = SONG_START;
  private started = false;
  private skipRequested = false;
  private readonly hats: Hats;
  private riser: AudioBufferSourceNode | null = null;

  // Caches de parsing (les pistes sont des chaînes constantes).
  private readonly drumCache = new Map<string, number[]>();
  private readonly noteCache = new Map<string, (NoteEvent | null)[]>();

  constructor(
    private readonly mixer: Mixer,
    private readonly timeline: EventTimeline,
    private readonly tempo: TempoMap,
    song: Song,
  ) {
    this.song = song;
    this.hats = new Hats(mixer.ctx, mixer.drums);
  }

  /** Charge un morceau ; il démarrera à sa première section au prochain step 0. */
  load(song: Song): void {
    this.song = song;
    this.started = false;
    this.skipRequested = false;
  }

  /** Debug : passe à la section suivante à la prochaine mesure. */
  requestSkip(): void {
    this.skipRequested = true;
  }

  get position(): SongPosition {
    return this.pos;
  }

  playStep(step: number, time: number): void {
    const stepInBar = step % STEPS_PER_BAR;
    if (stepInBar === 0) this.onBarStart(step, time);
    if (!this.started) return;

    const sec = sectionOf(this.song, this.pos);
    const bar = this.pos.barInSection;
    const ctx = this.mixer.ctx;

    // ─── Batterie ───
    const k = this.drum(sec.kick, bar, stepInBar);
    if (k > 0) {
      playKick(ctx, this.mixer.kickBus, time, k);
      this.mixer.duck(time, k);
      this.timeline.push('kick', time, k);
    }

    let s = this.drum(sec.snare, bar, stepInBar);
    if (s > 0) {
      if (sec.snareCrescendoFromBar !== undefined) {
        const from = sec.snareCrescendoFromBar;
        const progress = (bar - from + stepInBar / STEPS_PER_BAR) / (sec.bars - from);
        s *= 0.3 + 0.7 * Math.min(1, Math.max(0, progress));
      }
      playSnare(ctx, this.mixer.drums, time, s);
      this.timeline.push('snare', time, s);
    }

    const ho = this.drum(sec.hatOpen, bar, stepInBar);
    const hc = this.drum(sec.hatClosed, bar, stepInBar);
    if (ho > 0) this.hats.open(time, ho);
    else if (hc > 0) this.hats.closed(time, hc);
    if (ho > 0 || hc > 0) this.timeline.push('hat', time, Math.max(ho, hc));

    // ─── Mélodique ───
    const chord = this.song.progression[chordIndexAt(this.song, bar)];
    const stepDur = 60 / this.tempo.bpmAtTime(time) / STEPS_PER_BEAT;

    const b = this.note(sec.bass, bar, stepInBar);
    if (b) playBass(ctx, this.mixer.bassBus, time, bassNote(b.token, chord, this.song.bassRoot), b.length * stepDur * 0.92);

    const a = this.note(sec.arp, bar, stepInBar);
    if (a) {
      // Léger accent sur les temps forts : l'arpège « groove » au lieu de mitrailler.
      const accent = stepInBar % 4 === 0 ? 1 : 0.75;
      playLead(ctx, this.mixer.leadBus, time, arpNote(a.token, chord, this.song.leadRoot), a.length * stepDur, accent);
    }
  }

  /** Début de mesure : avance dans l'arrangement et planifie les automations de la mesure. */
  private onBarStart(step: number, time: number): void {
    if (!this.started) {
      this.started = true;
      this.pos = SONG_START;
    } else {
      this.pos = this.skipRequested ? nextSectionStart(this.song, this.pos) : advanceBar(this.song, this.pos);
    }
    const wasSkip = this.skipRequested;
    this.skipRequested = false;

    const sec = sectionOf(this.song, this.pos);
    const bar = this.pos.barInSection;
    const beat = step / STEPS_PER_BEAT;
    const barEnd = this.tempo.timeAt(beat + BEATS_PER_BAR);

    if (bar === 0) this.onSectionStart(sec, beat, time, wasSkip);

    // Filtre de la musique : on interpole mesure par mesure (robuste aux changements de tempo).
    const filter = sec.musicFilter ?? { from: 18000, to: 18000 };
    const fAt = (b: number) => filter.from * Math.pow(filter.to / filter.from, b / sec.bars);
    this.mixer.rampMusicFilter(fAt(bar), fAt(bar + 1), time, barEnd);

    // Riser jusqu'à la fin de la section.
    if (sec.riserFromBar === bar) {
      const sectionEnd = this.tempo.timeAt(beat + (sec.bars - bar) * BEATS_PER_BAR);
      this.riser = playRiser(this.mixer.ctx, this.mixer.drums, time, sectionEnd - time);
    }
  }

  private onSectionStart(sec: Section, beat: number, time: number, wasSkip: boolean): void {
    // Après un saut de section (debug), on coupe un éventuel riser orphelin.
    if (wasSkip && this.riser) {
      try {
        this.riser.stop(time);
      } catch {
        /* déjà arrêté */
      }
    }
    this.riser = null;
    this.mixer.syncDelay(this.tempo.bpmAtTime(time), time);
    if (sec.crash) playCrash(this.mixer.ctx, this.mixer.drums, time);
    this.timeline.pushSection({
      time,
      beat,
      index: this.pos.section,
      name: sec.name,
      bars: sec.bars,
      intensity: sec.intensity,
      loop: this.pos.loop,
    });
  }

  private drum(track: Track | undefined, bar: number, stepInBar: number): number {
    const src = trackBar(track, bar);
    if (src === null) return 0;
    let parsed = this.drumCache.get(src);
    if (!parsed) this.drumCache.set(src, (parsed = parsePattern(src)));
    return parsed[stepInBar % parsed.length] ?? 0;
  }

  private note(track: Track | undefined, bar: number, stepInBar: number): NoteEvent | null {
    const src = trackBar(track, bar);
    if (src === null) return null;
    let parsed = this.noteCache.get(src);
    if (!parsed) this.noteCache.set(src, (parsed = parseNotes(src)));
    return parsed[stepInBar % parsed.length] ?? null;
  }
}
