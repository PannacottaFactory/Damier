import { BEATS_PER_BAR, STEPS_PER_BEAT } from '../config';
import type { Mixer } from './mixer';
import { parsePattern, type Song } from './songs/types';
import { Hats } from './synth/hat';
import { playKick } from './synth/kick';
import type { EventTimeline } from './timeline';

const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR;

/**
 * Séquenceur pas-à-pas : pour chaque double croche planifiée par le Scheduler,
 * déclenche les instruments du morceau à la date exacte, et note les événements
 * dans la timeline (pour la synchro visuelle).
 */
export class Sequencer {
  private kick: number[] = [];
  private hatClosed: number[] = [];
  private hatOpen: number[] = [];
  private readonly hats: Hats;

  constructor(
    private readonly mixer: Mixer,
    private readonly timeline: EventTimeline,
    song: Song,
  ) {
    this.hats = new Hats(mixer.ctx, mixer.drums);
    this.load(song);
  }

  load(song: Song): void {
    this.kick = parsePattern(song.drums.kick);
    this.hatClosed = parsePattern(song.drums.hatClosed);
    this.hatOpen = parsePattern(song.drums.hatOpen);
  }

  playStep(step: number, time: number): void {
    const i = step % STEPS_PER_BAR;
    const ctx = this.mixer.ctx;

    const k = at(this.kick, i);
    if (k > 0) {
      playKick(ctx, this.mixer.kickBus, time, k);
      this.timeline.push('kick', time, k);
    }

    // Le hat ouvert a priorité ; un hat fermé sur le même step serait de toute façon étouffé.
    const ho = at(this.hatOpen, i);
    const hc = at(this.hatClosed, i);
    if (ho > 0) this.hats.open(time, ho);
    else if (hc > 0) this.hats.closed(time, hc);
    if (ho > 0 || hc > 0) this.timeline.push('hat', time, Math.max(ho, hc));
  }
}

/** Lecture cyclique d'un pattern (un pattern d'1 mesure boucle sur toutes les mesures). */
function at(pattern: number[], i: number): number {
  return pattern.length === 0 ? 0 : pattern[i % pattern.length];
}
