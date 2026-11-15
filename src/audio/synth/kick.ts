import { noiseSource } from './noise';

/**
 * Kick : sinus avec enveloppe de hauteur rapide (150 → 40 Hz) + petit clic de bruit
 * pour l'attaque. La saturation est appliquée par le bus kick du mixer.
 */
export function playKick(ctx: BaseAudioContext, out: AudioNode, time: number, velocity = 1): void {
  const osc = new OscillatorNode(ctx, { type: 'sine', frequency: 150 });
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.09);

  const amp = new GainNode(ctx, { gain: 0 });
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(velocity, time + 0.003);
  amp.gain.setTargetAtTime(0, time + 0.06, 0.09);

  osc.connect(amp).connect(out);
  osc.start(time);
  osc.stop(time + 0.5);

  // Clic d'attaque : quelques ms de bruit filtré.
  const click = noiseSource(ctx, time, 0.01);
  const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 3500, Q: 0.8 });
  const clickAmp = new GainNode(ctx, { gain: 0 });
  clickAmp.gain.setValueAtTime(0.35 * velocity, time);
  clickAmp.gain.exponentialRampToValueAtTime(0.001, time + 0.008);
  click.connect(bp).connect(clickAmp).connect(out);
}
