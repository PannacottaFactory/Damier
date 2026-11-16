import { GRID_SIZE } from '../../config';
import type { CellXY, Pattern } from '../types';

/**
 * Patterns simples (étape 4) : ligne, colonne, croix.
 * Les variantes sont énumérées ici ; à l'étape 5, les transformations
 * (rotation, miroir, inversion) les généreront à partir d'une forme de base.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function rowCells(y: number): CellXY[] {
  return range(GRID_SIZE).map((x) => [x, y] as const);
}

export function columnCells(x: number): CellXY[] {
  return range(GRID_SIZE).map((y) => [x, y] as const);
}

function crossCells(cx: number, cy: number): CellXY[] {
  return [...rowCells(cy), ...columnCells(cx).filter(([, y]) => y !== cy)];
}

export const BASIC_PATTERNS: readonly Pattern[] = [
  ...range(GRID_SIZE).map((y) => ({
    id: `row-${y}`,
    family: 'row',
    steps: [{ beatOffset: 0, cells: rowCells(y) }],
  })),
  ...range(GRID_SIZE).map((x) => ({
    id: `column-${x}`,
    family: 'column',
    steps: [{ beatOffset: 0, cells: columnCells(x) }],
  })),
  ...[1, 2, 3].flatMap((cx) =>
    [1, 2, 3].map((cy) => ({
      id: `cross-${cx}-${cy}`,
      family: 'cross',
      steps: [{ beatOffset: 0, cells: crossCells(cx, cy) }],
    })),
  ),
];
