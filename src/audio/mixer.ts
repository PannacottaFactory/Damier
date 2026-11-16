import { DEATH_MUFFLE_HZ } from '../config';

/**
 * Graphe de mixage :
 *
 *   kick ─► kickBus [drive → saturation] ──┐
 *   hats / snare / fx ─────────────────────┼─► drums ─────────────────────────┐
 *   basse ─► bassBus ─┐                    │                                  │
 *   lead ──► leadBus ─┼─► sidechain ─► musicFilter ─► music ──────────────────┼─► masterFilter ─► compresseur ─► master ─► sortie
 *            └─► delay (synchro tempo, feedback filtré) ─┘                    │   (passe-bas : coupure à la mort)
 *
 * - sidechain : le volume de la musique plonge à chaque kick (pompage électro).
 * - musicFilter : automation par section (le filtre qui s'ouvre pendant le BUILD).
 */
export class Mixer {
  readonly kickBus: GainNode;
  readonly drums: GainNode;
  readonly bassBus: GainNode;
  readonly leadBus: GainNode;
  readonly sidechain: GainNode;
  readonly musicFilter: BiquadFilterNode;
  readonly music: GainNode;
  readonly masterFilter: BiquadFilterNode;
  readonly compressor: DynamicsCompressorNode;
  readonly master: GainNode;
  private readonly delay: DelayNode;

  constructor(readonly ctx: AudioContext) {
    this.master = new GainNode(ctx, { gain: 0.8 });
    this.master.connect(ctx.destination);

    // Compresseur master : colle le mix et donne la « patate ».
    this.compressor = new DynamicsCompressorNode(ctx, {
      threshold: -14,
      knee: 6,
      ratio: 4,
      attack: 0.003,
      release: 0.15,
    });
    this.compressor.connect(this.master);

    this.masterFilter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 20000, Q: 0.7 });
    this.masterFilter.connect(this.compressor);

    // ─── Batterie ───
    this.drums = new GainNode(ctx, { gain: 1 });
    this.drums.connect(this.masterFilter);
    // Le kick passe par une légère saturation (harmoniques → il « perce » aussi sur petits haut-parleurs).
    this.kickBus = new GainNode(ctx, { gain: 1.6 });
    const shaper = new WaveShaperNode(ctx, { curve: saturationCurve(2.2), oversample: '2x' });
    const post = new GainNode(ctx, { gain: 0.75 });
    this.kickBus.connect(shaper).connect(post).connect(this.drums);

    // ─── Musique ───
    this.music = new GainNode(ctx, { gain: 1 });
    this.music.connect(this.masterFilter);
    this.musicFilter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 18000, Q: 1.2 });
    this.musicFilter.connect(this.music);
    this.sidechain = new GainNode(ctx, { gain: 1 });
    this.sidechain.connect(this.musicFilter);

    this.bassBus = new GainNode(ctx, { gain: 1 });
    this.bassBus.connect(this.sidechain);
    this.leadBus = new GainNode(ctx, { gain: 1 });
    this.leadBus.connect(this.sidechain);

    // Delay synchronisé (croche pointée) avec feedback filtré : les répétitions s'assombrissent.
    this.delay = new DelayNode(ctx, { maxDelayTime: 2, delayTime: 0.35 });
    const send = new GainNode(ctx, { gain: 0.32 });
    const feedback = new GainNode(ctx, { gain: 0.38 });
    const damp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 2800 });
    this.leadBus.connect(send).connect(this.delay);
    this.delay.connect(damp).connect(feedback).connect(this.delay);
    damp.connect(this.sidechain);
  }

  /** Cale le delay sur le tempo : croche pointée = 3/4 de temps. */
  syncDelay(bpm: number, time: number): void {
    this.delay.delayTime.setTargetAtTime((0.75 * 60) / bpm, time, 0.05);
  }

  /** Sidechain simulé : la musique plonge sur le kick puis remonte. */
  duck(time: number, velocity: number): void {
    const g = this.sidechain.gain;
    g.setTargetAtTime(1 - 0.75 * velocity, time, 0.003);
    g.setTargetAtTime(1, time + 0.045, 0.07);
  }

  /** Mort : tout le mix passe derrière un passe-bas (musique « étouffée ») ; relance : on rouvre. */
  muffle(on: boolean, time: number): void {
    const f = this.masterFilter.frequency;
    f.cancelScheduledValues(time);
    f.setValueAtTime(f.value, time);
    f.setTargetAtTime(on ? DEATH_MUFFLE_HZ : 20000, time, on ? 0.07 : 0.04);
  }

  /** Automation du filtre de la musique entre deux dates (interpolation exponentielle). */
  rampMusicFilter(fromHz: number, toHz: number, start: number, end: number): void {
    const f = this.musicFilter.frequency;
    f.cancelScheduledValues(start);
    f.setValueAtTime(fromHz, start);
    if (toHz !== fromHz) f.exponentialRampToValueAtTime(toHz, end);
  }
}

/** Courbe de saturation douce (tanh), normalisée pour que ±1 → ±1. */
function saturationCurve(drive: number, samples = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
}
