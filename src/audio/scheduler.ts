import { LATE_STEP_TOLERANCE_MS, SCHEDULE_AHEAD_MS, SCHEDULER_TICK_MS, STEPS_PER_BEAT } from '../config';
import type { TempoMap } from '../core/clock';

/** Appelé pour chaque double croche à planifier, avec sa date exacte (temps audio). */
export type StepCallback = (step: number, time: number) => void;

/**
 * Scheduler à lookahead (« A Tale of Two Clocks ») :
 * à chaque tick (~25 ms), on planifie toutes les doubles croches qui tombent
 * dans les ~100 ms à venir, à leur date exacte calculée par la TempoMap.
 * Le timer ne sert qu'à se réveiller : il n'influence jamais la date des notes.
 */
export class Scheduler {
  private nextStep = 0;
  private running = false;
  private readonly worker: Worker;
  private readonly listeners: StepCallback[] = [];

  constructor(
    private readonly ctx: AudioContext,
    private readonly tempo: TempoMap,
  ) {
    this.worker = new Worker(new URL('./scheduler.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = () => this.tick();
  }

  onStep(cb: StepCallback): void {
    this.listeners.push(cb);
  }

  start(fromStep = 0): void {
    this.nextStep = fromStep;
    this.running = true;
    this.worker.postMessage({ cmd: 'start', interval: SCHEDULER_TICK_MS });
    this.tick();
  }

  stop(): void {
    this.running = false;
    this.worker.postMessage({ cmd: 'stop' });
  }

  /** Premier beat pas encore planifié : un changement de tempo doit tomber à partir de là. */
  get nextUnscheduledBeat(): number {
    return this.nextStep / STEPS_PER_BEAT;
  }

  /** Peut aussi être appelé depuis la boucle de rendu : c'est idempotent. */
  tick(): void {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    const horizon = now + SCHEDULE_AHEAD_MS / 1000;
    const lateLimit = now - LATE_STEP_TOLERANCE_MS / 1000;
    for (;;) {
      const t = this.tempo.timeAt(this.nextStep / STEPS_PER_BEAT);
      if (t >= horizon) break;
      // Step trop en retard (onglet gelé…) : on le saute plutôt que de jouer un paquet de notes d'un coup.
      if (t >= lateLimit) for (const cb of this.listeners) cb(this.nextStep, t);
      this.nextStep++;
    }
  }
}
