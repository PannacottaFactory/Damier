import type { Rng } from '../core/random';
import type { SectionName } from '../audio/songs/types';

/**
 * Patterns de danger, décrits en données.
 * Un pattern est une suite d'étapes ; chaque étape fait exploser un ensemble de cases
 * à `beatOffset` temps après le début du pattern (toujours sur la grille des doubles croches).
 */
export type CellXY = readonly [x: number, y: number];

export interface PatternStep {
  /** Temps de l'impact, relatif au début du pattern (multiple de 0.25). */
  beatOffset: number;
  cells: readonly CellXY[];
  /**
   * Étape « fantôme » (call & response) : avertissement seul, sans impact.
   * Elle montre au joueur ce qui va arriver, puis le pattern est rejoué pour de vrai.
   */
  ghost?: boolean;
}

export interface Pattern {
  /** Identifiant unique de la variante (ex. « line-r1 »). */
  id: string;
  /** Famille (« line », « cross »…) : le director évite d'en jouer deux identiques d'affilée. */
  family: string;
  steps: readonly PatternStep[];
}

/**
 * Entrée de la bibliothèque : une famille de patterns et ses règles d'apparition.
 * Les variantes sont générées (transformations, et tirage aléatoire pour pluie / serpent…).
 */
export interface PatternDef {
  family: string;
  /** Difficulté minimale (intensité de section + bonus de boucle) pour apparaître. */
  minIntensity: number;
  /** Poids relatif dans le tirage (défaut 1). */
  weight?: number;
  /**
   * « Gros » pattern : ne démarre que sur un début de phrase (temps 1 de la mesure 1 sur 4).
   * Les petits patterns remplissent les autres créneaux.
   */
  big?: boolean;
  /** Sections autorisées (absent = toutes). Ex. la pluie : seulement pendant les drops. */
  sections?: readonly SectionName[];
  /** Variantes candidates ; `rng` sert aux patterns aléatoires, `difficulty` (0..~1.3) à leur densité. */
  variants(rng: Rng, difficulty: number): Pattern[];
}

/** Durée d'un pattern en temps (dernier impact inclus). */
export function patternLength(p: Pattern): number {
  return Math.max(0, ...p.steps.map((s) => s.beatOffset));
}
