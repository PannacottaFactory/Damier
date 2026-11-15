import { midiToHz } from '../songs/types';

/**
 * Lead / arpège : carré + dent de scie désaccordée, passe-bas, enveloppe courte et percussive.
 * Le delay synchronisé au tempo est appliqué par le mixer (bus lead).
 */
export function playLead(
  ctx: BaseAudioContext,
  out: AudioNode,
  time: number,
  midi: number,
  duration: number,
  velocity = 1,
): void {
  const f = midiToHz(midi);
  // Les notes longues (BREAK) tiennent un peu, les doubles croches restent sèches.
  const decay = Math.min(0.35, 0.06 + duration * 0.25);

  const filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 3200, Q: 2 });
  filter.frequency.setValueAtTime(5200, time);
  filter.frequency.setTargetAtTime(2200, time, 0.06);

  const amp = new GainNode(ctx, { gain: 0 });
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(0.11 * velocity, time + 0.003);
  amp.gain.setTargetAtTime(0, time + 0.01, decay);
  filter.connect(amp).connect(out);

  const a = new OscillatorNode(ctx, { type: 'square', frequency: f });
  const b = new OscillatorNode(ctx, { type: 'sawtooth', frequency: f, detune: -9 });
  const bGain = new GainNode(ctx, { gain: 0.6 });
  a.connect(filter);
  b.connect(bGain).connect(filter);
  const stop = time + 0.02 + decay * 6;
  a.start(time);
  b.start(time);
  a.stop(stop);
  b.stop(stop);
}
