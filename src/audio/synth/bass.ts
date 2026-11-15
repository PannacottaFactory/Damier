import { midiToHz } from '../songs/types';

/**
 * Basse : deux dents de scie légèrement désaccordées + un sinus en renfort,
 * passe-bas résonant avec enveloppe de filtre (le « pluck » électro).
 * Le sidechain (volume qui plonge sur chaque kick) est fait par le mixer.
 */
export function playBass(
  ctx: BaseAudioContext,
  out: AudioNode,
  time: number,
  midi: number,
  duration: number,
  cutoff = 520,
): void {
  const f = midiToHz(midi);
  const end = time + duration;

  const filter = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 7 });
  filter.frequency.setValueAtTime(cutoff * 5, time);
  filter.frequency.setTargetAtTime(cutoff, time, 0.045);

  const amp = new GainNode(ctx, { gain: 0 });
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(0.32, time + 0.004);
  amp.gain.setValueAtTime(0.32, Math.max(time + 0.004, end - 0.01));
  amp.gain.setTargetAtTime(0, end - 0.01, 0.015);
  filter.connect(amp).connect(out);

  const oscs = [
    new OscillatorNode(ctx, { type: 'sawtooth', frequency: f, detune: -7 }),
    new OscillatorNode(ctx, { type: 'sawtooth', frequency: f, detune: 7 }),
  ];
  const sub = new OscillatorNode(ctx, { type: 'sine', frequency: f });
  const subGain = new GainNode(ctx, { gain: 0.7 });
  sub.connect(subGain).connect(amp);
  for (const o of oscs) o.connect(filter);
  for (const o of [...oscs, sub]) {
    o.start(time);
    o.stop(end + 0.12);
  }
}
