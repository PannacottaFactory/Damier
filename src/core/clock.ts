import { BEATS_PER_BAR, DEFAULT_LATENCY_OFFSET_MS, STEPS_PER_BEAT } from '../config';

/**
 * L'horloge unique du jeu.
 *
 * - `TempoMap` : conversion temps ↔ beats, avec changements de tempo (bonus Ralenti,
 *   ralenti debug). Pure, sans dépendance au navigateur → testée unitairement.
 * - `Clock` : branche la TempoMap sur `AudioContext.currentTime` et fournit le
 *   « temps perçu » (ce que le joueur entend en ce moment), qui sert au rendu,
 *   aux inputs et aux collisions.
 *
 * Tous les temps sont en secondes dans le référentiel de l'AudioContext.
 */

/** Source de temps du jeu, en secondes. */
export interface TimeSource {
  now(): number;
}

// ─── TempoMap ───────────────────────────────────────────────────────────────

/** Un segment de tempo constant, qui commence à `time` (= `beat`). */
interface TempoSegment {
  time: number;
  beat: number;
  bpm: number;
}

export class TempoMap {
  private segments: TempoSegment[] = [];

  constructor(bpm: number, startTime = 0) {
    this.reset(bpm, startTime);
  }

  /** Repart de zéro : le beat 0 tombe à `startTime`. */
  reset(bpm: number, startTime: number): void {
    this.segments = [{ time: startTime, beat: 0, bpm }];
  }

  /** Dernier segment qui commence avant `t` (le premier sert aussi à extrapoler avant le début). */
  private segmentAtTime(t: number): TempoSegment {
    const s = this.segments;
    for (let i = s.length - 1; i > 0; i--) if (s[i].time <= t) return s[i];
    return s[0];
  }

  private segmentAtBeat(b: number): TempoSegment {
    const s = this.segments;
    for (let i = s.length - 1; i > 0; i--) if (s[i].beat <= b) return s[i];
    return s[0];
  }

  /** Beat (fractionnaire) à l'instant `t`. Négatif avant le départ. */
  beatAt(t: number): number {
    const s = this.segmentAtTime(t);
    return s.beat + ((t - s.time) * s.bpm) / 60;
  }

  /** Instant où tombe le beat `b`. */
  timeAt(b: number): number {
    const s = this.segmentAtBeat(b);
    return s.time + ((b - s.beat) * 60) / s.bpm;
  }

  bpmAtTime(t: number): number {
    return this.segmentAtTime(t).bpm;
  }

  bpmAtBeat(b: number): number {
    return this.segmentAtBeat(b).bpm;
  }

  /**
   * Change de tempo à partir du beat `atBeat` (en général un début de temps,
   * situé après tout ce qui est déjà planifié). Les segments postérieurs sont remplacés.
   * La courbe reste continue : le beat `atBeat` garde exactement la même date.
   */
  setTempo(bpm: number, atBeat: number): void {
    const time = this.timeAt(atBeat);
    this.segments = this.segments.filter((s) => s.beat < atBeat);
    this.segments.push({ time, beat: atBeat, bpm });
  }
}

// ─── Position musicale ──────────────────────────────────────────────────────

export interface MusicalPosition {
  /** Beat fractionnaire global. */
  beat: number;
  /** Index de la mesure (0, 1, 2…). */
  bar: number;
  /** Temps dans la mesure, 0..3 (entier). */
  beatInBar: number;
  /** Double croche globale (entier). */
  step: number;
  /** Double croche dans la mesure, 0..15. */
  stepInBar: number;
  /** Position de la mesure dans les phrases de 4, 8 et 16 mesures. */
  barInPhrase4: number;
  barInPhrase8: number;
  barInPhrase16: number;
}

/** Modulo toujours positif (les beats sont négatifs avant le départ). */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function musicalPosition(beat: number): MusicalPosition {
  const wholeBeat = Math.floor(beat);
  const bar = Math.floor(beat / BEATS_PER_BAR);
  const step = Math.floor(beat * STEPS_PER_BEAT + 1e-9);
  return {
    beat,
    bar,
    beatInBar: mod(wholeBeat, BEATS_PER_BAR),
    step,
    stepInBar: mod(step, BEATS_PER_BAR * STEPS_PER_BEAT),
    barInPhrase4: mod(bar, 4),
    barInPhrase8: mod(bar, 8),
    barInPhrase16: mod(bar, 16),
  };
}

// ─── Clock (liée à l'AudioContext) ──────────────────────────────────────────

export class Clock implements TimeSource {
  readonly tempo: TempoMap;

  /** Décalage lissé entre performance.now() et le temps audio réellement entendu. */
  private offset = 0;
  private synced = false;

  /** Compensation manuelle (calibration), en secondes. Positif = l'image est retardée. */
  latencyOffset = DEFAULT_LATENCY_OFFSET_MS / 1000;

  constructor(
    private readonly ctx: AudioContext,
    bpm: number,
  ) {
    this.tempo = new TempoMap(bpm, 0);
  }

  get running(): boolean {
    return this.ctx.state === 'running';
  }

  /** Temps de l'horloge audio (là où l'on planifie les notes). */
  audioTime(): number {
    return this.ctx.currentTime;
  }

  /**
   * Recale l'horloge perçue sur l'audio. À appeler une fois par frame.
   *
   * `getOutputTimestamp()` donne le couple (temps audio en sortie des haut-parleurs,
   * performance.now() correspondant) : il intègre déjà la latence de sortie.
   * On en déduit un décalage qu'on lisse (currentTime avance par paquets de
   * plusieurs ms, ce qui ferait trembler l'animation). Gros écart → recalage direct.
   */
  sync(): void {
    if (!this.running) return;
    let raw: number;
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime && ts.performanceTime) {
      raw = ts.contextTime - ts.performanceTime / 1000;
    } else {
      const latency = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
      raw = this.ctx.currentTime - latency - performance.now() / 1000;
    }
    if (!this.synced || Math.abs(raw - this.offset) > 0.05) {
      this.offset = raw;
      this.synced = true;
    } else {
      this.offset += (raw - this.offset) * 0.03;
    }
  }

  /** Temps perçu : l'instant audio que le joueur entend en ce moment. */
  now(): number {
    return performance.now() / 1000 + this.offset - this.latencyOffset;
  }

  /** Beat perçu courant. */
  beat(): number {
    return this.tempo.beatAt(this.now());
  }

  bpm(): number {
    return this.tempo.bpmAtTime(this.now());
  }

  /** Démarre le morceau : le beat 0 tombera à `startTime` (temps audio). */
  start(startTime: number, bpm: number): void {
    this.tempo.reset(bpm, startTime);
    this.synced = false;
    this.sync();
  }
}
