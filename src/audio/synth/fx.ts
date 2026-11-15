import { noiseBuffer, noiseSource } from './noise';

/** Crash : bruit aigu à longue décroissance, sur le premier temps des drops. */
export function playCrash(ctx: BaseAudioContext, out: AudioNode, time: number): void {
  const src = noiseSource(ctx, time, 2.5);
  const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 4500 });
  const amp = new GainNode(ctx, { gain: 0 });
  amp.gain.setValueAtTime(0.32, time);
  amp.gain.setTargetAtTime(0, time + 0.01, 0.55);
  src.connect(hp).connect(amp).connect(out);
}

/**
 * Riser : bruit en boucle dans un passe-bande qui monte, volume croissant.
 * Renvoie la source pour pouvoir le couper (saut de section en debug).
 */
export function playRiser(
  ctx: BaseAudioContext,
  out: AudioNode,
  time: number,
  duration: number,
): AudioBufferSourceNode {
  const src = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer(ctx), loop: true });
  const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 400, Q: 3 });
  bp.frequency.setValueAtTime(400, time);
  bp.frequency.exponentialRampToValueAtTime(9000, time + duration);
  const amp = new GainNode(ctx, { gain: 0 });
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(0.22, time + duration);
  amp.gain.setValueAtTime(0, time + duration);
  src.connect(bp).connect(amp).connect(out);
  src.start(time);
  src.stop(time + duration + 0.01);
  return src;
}
