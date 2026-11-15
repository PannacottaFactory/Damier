/**
 * Mémoire des événements musicaux planifiés (kick, snare…), datés en temps audio.
 * Le rendu y lit « quand a eu lieu le dernier kick ? » par rapport au temps PERÇU :
 * comme les notes sont planifiées ~100 ms en avance, l'effet visuel se déclenche
 * pile quand le son sort des haut-parleurs.
 */
export type MusicEventType = 'kick' | 'snare' | 'hat';

export interface MusicEvent {
  type: MusicEventType;
  time: number;
  velocity: number;
}

/** Durée de rétention des événements passés. */
const KEEP_SECONDS = 4;

export class EventTimeline {
  private events: MusicEvent[] = [];

  push(type: MusicEventType, time: number, velocity = 1): void {
    this.events.push({ type, time, velocity });
  }

  /** Dernier événement de ce type survenu à `now` ou avant. */
  last(type: MusicEventType, now: number): MusicEvent | null {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      if (e.type === type && e.time <= now) return e;
    }
    return null;
  }

  /** Purge des vieux événements (appelée une fois par frame). */
  prune(now: number): void {
    const limit = now - KEEP_SECONDS;
    let i = 0;
    while (i < this.events.length && this.events[i].time < limit) i++;
    if (i > 0) this.events.splice(0, i);
  }

  clear(): void {
    this.events.length = 0;
  }
}
