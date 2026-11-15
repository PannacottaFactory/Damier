/** Buffer de bruit blanc partagé (généré une fois par AudioContext). */
const cache = new WeakMap<BaseAudioContext, AudioBuffer>();

export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = cache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    cache.set(ctx, buf);
  }
  return buf;
}

/** Source de bruit démarrant à un endroit aléatoire du buffer (évite que chaque coup sonne identique). */
export function noiseSource(ctx: BaseAudioContext, time: number, duration: number): AudioBufferSourceNode {
  const src = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer(ctx) });
  src.start(time, Math.random() * 1.5, duration + 0.05);
  return src;
}
