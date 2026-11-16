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
}

export interface Pattern {
  /** Identifiant unique de la variante (ex. « row-2 »). */
  id: string;
  /** Famille (« row », « cross »…) : le director évite d'en jouer deux identiques d'affilée. */
  family: string;
  steps: readonly PatternStep[];
}

/** Durée d'un pattern en temps (dernier impact inclus). */
export function patternLength(p: Pattern): number {
  return Math.max(0, ...p.steps.map((s) => s.beatOffset));
}
