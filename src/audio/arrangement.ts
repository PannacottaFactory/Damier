import type { Section, Song } from './songs/types';

/**
 * Navigation dans la structure d'un morceau (fonctions pures, testées).
 * INTRO → BUILD → DROP → BREAK → DROP2 → (reboucle sur `loopFrom`) …
 */
export interface SongPosition {
  section: number;
  barInSection: number;
  /** Nombre de rebouclages effectués (sert à faire monter la difficulté). */
  loop: number;
}

export const SONG_START: SongPosition = { section: 0, barInSection: 0, loop: 0 };

export function sectionOf(song: Song, pos: SongPosition): Section {
  return song.sections[pos.section];
}

/** Début de la section suivante (avec rebouclage). */
export function nextSectionStart(song: Song, pos: SongPosition): SongPosition {
  const next = pos.section + 1;
  if (next < song.sections.length) return { section: next, barInSection: 0, loop: pos.loop };
  return { section: song.loopFrom, barInSection: 0, loop: pos.loop + 1 };
}

/** Mesure suivante. */
export function advanceBar(song: Song, pos: SongPosition): SongPosition {
  if (pos.barInSection + 1 < sectionOf(song, pos).bars) return { ...pos, barInSection: pos.barInSection + 1 };
  return nextSectionStart(song, pos);
}

/** Accord joué à une mesure donnée de la section (la progression repart à chaque section). */
export function chordIndexAt(song: Song, barInSection: number): number {
  return Math.floor(barInSection / song.barsPerChord) % song.progression.length;
}
