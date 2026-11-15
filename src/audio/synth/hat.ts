import { noiseSource } from './noise';

/**
 * Hi-hats : bruit blanc passe-haut.
 * Fermé = très court ; ouvert = plus long, et « étouffé » (choke) par le hat suivant,
 * comme sur une vraie charleston.
 */
export class Hats {
  private openAmp: GainNode | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
  ) {}

  closed(time: number, velocity = 1): void {
    this.choke(time);
    this.hit(time, velocity * 0.32, 0.045, 8500);
  }

  open(time: number, velocity = 1): void {
    this.choke(time);
    this.openAmp = this.hit(time, velocity * 0.26, 0.32, 7000);
  }

  private choke(time: number): void {
    if (!this.openAmp) return;
    this.openAmp.gain.cancelScheduledValues(time);
    this.openAmp.gain.setTargetAtTime(0, time, 0.008);
    this.openAmp = null;
  }

  private hit(time: number, gain: number, decay: number, cutoff: number): GainNode {
    const { ctx } = this;
    const src = noiseSource(ctx, time, decay * 3);
    const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: cutoff, Q: 0.9 });
    const air = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 11000, Q: 1, gain: 5 });
    const amp = new GainNode(ctx, { gain: 0 });
    amp.gain.setValueAtTime(gain, time);
    amp.gain.setTargetAtTime(0, time + 0.002, decay / 3);
    src.connect(hp).connect(air).connect(amp).connect(this.out);
    return amp;
  }
}
