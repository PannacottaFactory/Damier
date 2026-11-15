/**
 * Graphe de mixage :
 *
 *   kick ─► kickBus [drive → saturation] ─┐
 *   hats / snare ─────────────────────────┼─► drums ─┐
 *   basse / lead (étape 3) ──────────────► music ────┼─► masterFilter (passe-bas, coupure à la mort)
 *                                                    └─► compresseur ─► master ─► sortie
 */
export class Mixer {
  readonly kickBus: GainNode;
  readonly drums: GainNode;
  readonly music: GainNode;
  readonly masterFilter: BiquadFilterNode;
  readonly compressor: DynamicsCompressorNode;
  readonly master: GainNode;

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

    this.drums = new GainNode(ctx, { gain: 1 });
    this.drums.connect(this.masterFilter);
    this.music = new GainNode(ctx, { gain: 1 });
    this.music.connect(this.masterFilter);

    // Le kick passe par une légère saturation (harmoniques → il « perce » aussi sur petits haut-parleurs).
    this.kickBus = new GainNode(ctx, { gain: 1.6 });
    const shaper = new WaveShaperNode(ctx, { curve: saturationCurve(2.2), oversample: '2x' });
    const post = new GainNode(ctx, { gain: 0.75 });
    this.kickBus.connect(shaper).connect(post).connect(this.drums);
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
