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

/** Une section placée dans le temps (même forme que les SectionEvent de la timeline). */
export interface SectionSpan {
  index: number;
  name: Section['name'];
  intensity: number;
  bars: number;
  loop: number;
  /** Beat global du début de la section. */
  beat: number;
}

/**
 * Prévoit la section qui jouera à `beat`, à partir d'une section connue `from`.
 * Le director choisit ses patterns plusieurs temps avant qu'ils tombent : il doit savoir
 * si l'impact atterrira dans le drop qui arrive, pas dans le build en cours.
 * (Un saut de section en debug n'est pas prévisible : la prévision se recale à la section suivante.)
 */
export function sectionAtBeat(song: Song, from: SectionSpan, beat: number): SectionSpan {
  let span = from;
  // Garde-fou : quelques centaines de sections au plus.
  for (let i = 0; i < 1000 && beat >= span.beat + span.bars * 4; i++) {
    const pos = nextSectionStart(song, { section: span.index, barInSection: 0, loop: span.loop });
    const sec = sectionOf(song, pos);
    span = {
      index: pos.section,
      name: sec.name,
      intensity: sec.intensity,
      bars: sec.bars,
      loop: pos.loop,
      beat: span.beat + span.bars * 4,
    };
  }
  return span;
}
