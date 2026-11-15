import { noiseSource } from './noise';

/**
 * Snare / clap : bruit filtré passe-bande avec 3 micro-impacts rapprochés
 * (signature d'un clap), plus un petit corps tonal pour le punch.
 */
export function playSnare(ctx: BaseAudioContext, out: AudioNode, time: number, velocity = 1): void {
  // Bruit « clap ».
  const src = noiseSource(ctx, time, 0.3);
  const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 1700, Q: 0.9 });
  const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 600 });
  const amp = new GainNode(ctx, { gain: 0 });
  const v = 0.9 * velocity;
  const g = amp.gain;
  g.setValueAtTime(v, time);
  g.setValueAtTime(v * 0.25, time + 0.007);
  g.setValueAtTime(v * 0.9, time + 0.01);
  g.setValueAtTime(v * 0.25, time + 0.017);
  g.setValueAtTime(v * 0.8, time + 0.02);
  g.setTargetAtTime(0, time + 0.022, 0.045);
  src.connect(bp).connect(hp).connect(amp).connect(out);

  // Corps tonal.
  const osc = new OscillatorNode(ctx, { type: 'triangle', frequency: 220 });
  osc.frequency.setValueAtTime(220, time);
  osc.frequency.exponentialRampToValueAtTime(160, time + 0.05);
  const body = new GainNode(ctx, { gain: 0 });
  body.gain.setValueAtTime(0.35 * velocity, time);
  body.gain.setTargetAtTime(0, time + 0.005, 0.03);
  osc.connect(body).connect(out);
  osc.start(time);
  osc.stop(time + 0.2);
}
