import { AUDIO_START_DELAY_MS } from '../config';
import { Clock } from '../core/clock';
import { Mixer } from './mixer';
import { Scheduler } from './scheduler';
import { Sequencer } from './sequencer';
import type { Song } from './songs/types';
import { EventTimeline } from './timeline';

/**
 * Assemble la chaîne audio : AudioContext → Clock (horloge unique) → Scheduler → Sequencer → Mixer.
 * L'AudioContext est créé tout de suite mais reste suspendu jusqu'à `start()`,
 * qui doit être appelé depuis un geste utilisateur (contrainte des navigateurs).
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly mixer: Mixer;
  readonly clock: Clock;
  readonly timeline = new EventTimeline();
  readonly scheduler: Scheduler;
  readonly sequencer: Sequencer;
  private started = false;

  constructor(private song: Song) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.mixer = new Mixer(this.ctx);
    this.clock = new Clock(this.ctx, song.bpm);
    this.scheduler = new Scheduler(this.ctx, this.clock.tempo);
    this.sequencer = new Sequencer(this.mixer, this.timeline, this.clock.tempo, song);
    this.scheduler.onStep((step, time) => this.sequencer.playStep(step, time));
  }

  /** Vrai dès que l'audio tourne (le premier son a pu être émis). */
  get isRunning(): boolean {
    return this.started && this.clock.running;
  }

  /** À appeler dans un gestionnaire d'événement utilisateur (keydown, pointerdown). */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.ctx.resume();
    this.clock.start(this.ctx.currentTime + AUDIO_START_DELAY_MS / 1000, this.song.bpm);
    this.scheduler.start(0);
  }

  /** L'utilisateur a lancé l'audio (même si l'on est en pause). */
  get hasStarted(): boolean {
    return this.started;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  private paused = false;

  /**
   * Pause : on suspend l'AudioContext. Son temps s'arrête, donc la musique, les dangers
   * planifiés et l'animation se figent ensemble, et reprennent exactement au même point.
   */
  async setPaused(paused: boolean): Promise<void> {
    if (!this.started || paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      await this.ctx.suspend();
    } else {
      await this.ctx.resume();
      this.clock.resync();
    }
  }

  /** Une fois par frame : recale l'horloge perçue, complète la planification, purge la timeline. */
  frame(): void {
    this.clock.sync();
    this.scheduler.tick();
    this.timeline.prune(this.ctx.currentTime);
  }
}
