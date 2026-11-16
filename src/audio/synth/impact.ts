import { noiseSource } from './noise';

/**
 * Son d'impact d'un danger : « zap » descendant + souffle de bruit.
 * Volontairement discret : il double le temps fort sans masquer le kick.
 */
export function playImpact(ctx: BaseAudioContext, out: AudioNode, time: number, strength = 1): void {
  const zap = new OscillatorNode(ctx, { type: 'square', frequency: 1400 });
  zap.frequency.setValueAtTime(1400, time);
  zap.frequency.exponentialRampToValueAtTime(90, time + 0.08);
  const zapAmp = new GainNode(ctx, { gain: 0 });
  zapAmp.gain.setValueAtTime(0.07 * strength, time);
  zapAmp.gain.setTargetAtTime(0, time + 0.01, 0.03);
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 2500 });
  zap.connect(lp).connect(zapAmp).connect(out);
  zap.start(time);
  zap.stop(time + 0.2);

  const noise = noiseSource(ctx, time, 0.2);
  const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 1100, Q: 0.7 });
  const nAmp = new GainNode(ctx, { gain: 0 });
  nAmp.gain.setValueAtTime(0.22 * strength, time);
  nAmp.gain.setTargetAtTime(0, time + 0.005, 0.04);
  noise.connect(bp).connect(nAmp).connect(out);
}
