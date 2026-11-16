import { GRID_SIZE } from '../../config';
import type { CellXY, Pattern, PatternStep } from '../types';

/**
 * Formes de base du damier, réutilisées par toute la bibliothèque.
 * Les variantes (orientations, positions) sont obtenues par transformations.
 */

const N = GRID_SIZE;
const MAX = N - 1;
const C = Math.floor(N / 2);

export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

export function rowCells(y: number): CellXY[] {
  return range(N).map((x) => [x, y] as const);
}

export function columnCells(x: number): CellXY[] {
  return range(N).map((y) => [x, y] as const);
}

/** Ligne + colonne passant par (cx, cy). */
export function crossCells(cx: number, cy: number): CellXY[] {
  return [...rowCells(cy), ...columnCells(cx).filter(([, y]) => y !== cy)];
}

/** Les deux diagonales passant par (cx, cy). */
export function xCells(cx: number, cy: number): CellXY[] {
  const out: CellXY[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.abs(x - cx) === Math.abs(y - cy)) out.push([x, y]);
  return out;
}

/** Anneau à distance `d` du bord (0 = contour extérieur, 2 = case centrale). */
export function ringCells(d: number): CellXY[] {
  const out: CellXY[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) if (Math.min(x, y, MAX - x, MAX - y) === d) out.push([x, y]);
  }
  return out;
}

/** Damier : cases dont (x + y) a la parité donnée. */
export function checkerCells(parity: 0 | 1): CellXY[] {
  const out: CellXY[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2 === parity) out.push([x, y]);
  return out;
}

/** Ordre de parcours en spirale, depuis le coin (0, 0), dans le sens horaire, jusqu'au centre. */
export function spiralOrder(): CellXY[] {
  const out: CellXY[] = [];
  let [x0, y0, x1, y1] = [0, 0, MAX, MAX];
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]);
    if (x0 < x1) for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++;
    y0++;
    x1--;
    y1--;
  }
  return out;
}

export const CENTER: CellXY = [C, C];

/** Pattern à une seule étape. */
export function single(id: string, family: string, cells: readonly CellXY[]): Pattern {
  return { id, family, steps: [{ beatOffset: 0, cells }] };
}

/** Pattern à plusieurs étapes. */
export function sequence(id: string, family: string, steps: readonly PatternStep[]): Pattern {
  return { id, family, steps };
}

/** Voisins orthogonaux dans le damier. */
export function neighbors([x, y]: CellXY): CellXY[] {
  const out: CellXY[] = [];
  if (x > 0) out.push([x - 1, y]);
  if (x < MAX) out.push([x + 1, y]);
  if (y > 0) out.push([x, y - 1]);
  if (y < MAX) out.push([x, y + 1]);
  return out;
}

export const sameCell = (a: CellXY, b: CellXY): boolean => a[0] === b[0] && a[1] === b[1];
