import type { SectionName } from './songs/types';

/**
 * Mémoire des événements musicaux planifiés, datés en temps audio.
 * Le jeu les lit par rapport au temps PERÇU : comme tout est planifié ~100 ms
 * en avance, un effet visuel se déclenche pile quand le son sort des haut-parleurs.
 */
export type MusicEventType = 'kick' | 'snare' | 'hat';

export interface MusicEvent {
  type: MusicEventType;
  time: number;
  velocity: number;
}

/** Début d'une section musicale (lu par le jeu : difficulté, caméra, intensité visuelle). */
export interface SectionEvent {
  time: number;
  /** Beat global du début de section. */
  beat: number;
  index: number;
  name: SectionName;
  bars: number;
  intensity: number;
  loop: number;
}

/** Durée de rétention des événements passés. */
const KEEP_SECONDS = 4;

export class EventTimeline {
  private events: MusicEvent[] = [];
  private sections: SectionEvent[] = [];

  push(type: MusicEventType, time: number, velocity = 1): void {
    this.events.push({ type, time, velocity });
  }

  pushSection(e: SectionEvent): void {
    this.sections.push(e);
  }

  /** Dernier événement de ce type survenu à `now` ou avant. */
  last(type: MusicEventType, now: number): MusicEvent | null {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      if (e.type === type && e.time <= now) return e;
    }
    return null;
  }

  /** Section en cours à `now` (null avant le tout premier temps). */
  sectionAt(now: number): SectionEvent | null {
    for (let i = this.sections.length - 1; i >= 0; i--) {
      if (this.sections[i].time <= now) return this.sections[i];
    }
    return null;
  }

  /** Purge des vieux événements (on garde toujours la section en cours). */
  prune(now: number): void {
    const limit = now - KEEP_SECONDS;
    let i = 0;
    while (i < this.events.length && this.events[i].time < limit) i++;
    if (i > 0) this.events.splice(0, i);

    let s = 0;
    while (s + 1 < this.sections.length && this.sections[s + 1].time < limit) s++;
    if (s > 0) this.sections.splice(0, s);
  }

  clear(): void {
    this.events.length = 0;
    this.sections.length = 0;
  }
}
