import { dedupe, invert, symmetries } from '../transforms';
import type { PatternDef } from '../types';
import { crossCells, ringCells, rowCells, single, xCells } from './shapes';

/**
 * Petits patterns à un seul impact : ils remplissent les créneaux entre les débuts de phrase.
 * Une seule forme de base par position ; les orientations viennent des symétries.
 */

/** Toutes les orientations de plusieurs formes de base, sans doublons. */
const allOf = (...bases: Parameters<typeof symmetries>[0][]) => dedupe(bases.flatMap(symmetries));

export const LINE: PatternDef = {
  family: 'line',
  minIntensity: 0,
  weight: 1.2,
  // Lignes 0, 1, 2 → par rotation/miroir : les 5 lignes et les 5 colonnes.
  variants: () => allOf(...[0, 1, 2].map((y) => single(`line-${y}`, 'line', rowCells(y)))),
};

export const DOUBLE_LINE: PatternDef = {
  family: 'double-line',
  minIntensity: 0.3,
  variants: () =>
    allOf(
      ...[
        [0, 1],
        [1, 2],
        [0, 2],
        [1, 3],
        [0, 3],
        [0, 4],
      ].map(([a, b]) => single(`double-${a}${b}`, 'double-line', [...rowCells(a), ...rowCells(b)])),
    ),
};

export const CROSS: PatternDef = {
  family: 'cross',
  minIntensity: 0.15,
  // Centres (1,1), (1,2), (2,2) → les 9 centres intérieurs.
  variants: () =>
    allOf(
      ...[
        [1, 1],
        [1, 2],
        [2, 2],
      ].map(([x, y]) => single(`cross-${x}${y}`, 'cross', crossCells(x, y))),
    ),
};

export const X_SHAPE: PatternDef = {
  family: 'x',
  minIntensity: 0.3,
  variants: () =>
    allOf(
      ...[
        [2, 2],
        [1, 1],
        [1, 2],
      ].map(([x, y]) => single(`x-${x}${y}`, 'x', xCells(x, y))),
    ),
};

/** Bordure : tout le contour explose, il faut être dans le carré central. */
const border = single('border', 'border', ringCells(0));

export const BORDER: PatternDef = {
  family: 'border',
  minIntensity: 0.25,
  variants: () => [border],
};

/** Centre : l'inverse exact de la bordure — il faut rejoindre le contour. */
export const CENTER_BLOCK: PatternDef = {
  family: 'center',
  minIntensity: 0.2,
  variants: () => [{ ...invert(border), id: 'center', family: 'center' }],
};

/** Ligne sûre : inversion d'une ligne, tout le reste explose. */
export const SAFE_LINE: PatternDef = {
  family: 'safe-line',
  minIntensity: 0.55,
  weight: 0.8,
  variants: () =>
    allOf(...[0, 1, 2].map((y) => ({ ...invert(single(`safe-${y}`, 'safe-line', rowCells(y))) }))),
};
