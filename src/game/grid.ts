import { GRID_SIZE } from '../config';

/** Coordonnées d'une case : x = colonne (0 à gauche), y = ligne (0 en haut). */
export interface Cell {
  x: number;
  y: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

/** Vecteur unitaire associé à chaque direction. */
export const DIR_VECTORS: Readonly<Record<Dir, Readonly<Cell>>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

/** Case centrale du damier (point de départ du joueur). */
export const CENTER: Readonly<Cell> = {
  x: Math.floor(GRID_SIZE / 2),
  y: Math.floor(GRID_SIZE / 2),
};

export function inBounds(c: Cell, size = GRID_SIZE): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < size && c.y < size;
}

/** Case voisine dans une direction (peut être hors du damier). */
export function neighbor(c: Cell, dir: Dir): Cell {
  const v = DIR_VECTORS[dir];
  return { x: c.x + v.x, y: c.y + v.y };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Index unique d'une case, pratique pour les Set / tableaux plats. */
export function cellIndex(c: Cell, size = GRID_SIZE): number {
  return c.y * size + c.x;
}
