import type { Rng } from '../../core/random';
import { dedupe, rotate, symmetries, travel } from '../transforms';
import type { CellXY, Pattern, PatternDef, PatternStep } from '../types';
import { crossCells, range, rowCells, sequence, single } from './shapes';
import { spacingsFor } from './sequences';

/**
 * Patterns qui se déplacent : une forme avance case par case à travers le plateau.
 * Une case n'est jamais frappée plus de 2 fois (formes de 2 cases d'épaisseur au plus).
 */

/** Fusionne plusieurs séquences : les frappes au même temps s'additionnent. */
function merge(id: string, family: string, parts: readonly (readonly PatternStep[])[]): Pattern {
  const byOffset = new Map<number, CellXY[]>();
  for (const part of parts) for (const s of part) byOffset.set(s.beatOffset, [...(byOffset.get(s.beatOffset) ?? []), ...s.cells]);
  const offsets = [...byOffset.keys()].sort((a, b) => a - b);
  const first = offsets[0] ?? 0;
  return { id, family, steps: offsets.map((o) => ({ beatOffset: o - first, cells: byOffset.get(o)! })) };
}

/** Bloc 2×2 qui traverse le plateau. */
export const MOVING_BLOCK: PatternDef = {
  family: 'moving-block',
  minIntensity: 0.3,
  big: true,
  variants: (_rng, difficulty) =>
    dedupe(
      spacingsFor(difficulty).flatMap((speed) =>
        [0, 1, 3].flatMap((y) => {
          const block = single(`block-${y}`, 'moving-block', [
            [0, y],
            [1, y],
            [0, y + 1],
            [1, y + 1],
          ]);
          return symmetries(travel(block, [1, 0], 4, speed));
        }),
      ),
    ),
};

/** Croix qui glisse en diagonale d'un coin à l'autre. */
export const MOVING_CROSS: PatternDef = {
  family: 'moving-cross',
  minIntensity: 0.5,
  big: true,
  variants: (_rng, difficulty) =>
    dedupe(
      spacingsFor(difficulty).flatMap((speed) =>
        symmetries(
          sequence(
            `mcross-${speed}`,
            'moving-cross',
            range(5).map((k) => ({ beatOffset: k * speed, cells: crossCells(k, k) })),
          ),
        ),
      ),
    ),
};

/**
 * Train : une bande de 2 lignes qui traverse le plateau, 2 lignes par temps.
 * (Avancer d'une seule ligne par temps obligerait à traverser la bande entre deux frappes.)
 */
export const TRAIN: PatternDef = {
  family: 'train',
  minIntensity: 0.4,
  big: true,
  variants: () =>
    symmetries(
      sequence(
        'train',
        'train',
        [[0, 1], [2, 3], [4]].map((rows, k) => ({ beatOffset: k, cells: rows.flatMap(rowCells) })),
      ),
    ),
};

/**
 * Comètes : quelques cases isolées qui filent en ligne droite d'un bord à l'autre,
 * en décalé. Jamais deux comètes sur la même ligne ou la même colonne.
 */
export const COMETS: PatternDef = {
  family: 'comets',
  minIntensity: 0.45,
  big: true,
  variants: (rng, difficulty) => {
    const count = difficulty >= 0.8 ? 3 : 2;
    const speed = difficulty >= 0.8 ? 0.25 : 0.5;
    return range(5).map((v) => {
      const rows = shuffledRange(rng);
      const cols = shuffledRange(rng);
      const parts = range(count).map((i) => {
        const horizontal = i % 2 === 0;
        const lane = horizontal ? rows[i] : cols[i];
        const forward = rng() < 0.5;
        const delay = i * (speed * 2);
        return range(5).map((k) => {
          const p = forward ? k : 4 - k;
          return { beatOffset: delay + k * speed, cells: [horizontal ? ([p, lane] as const) : ([lane, p] as const)] };
        });
      });
      return merge(`comets-${v}`, 'comets', parts);
    });
  },
};

/** Petites formes (2 cases de haut au plus). */
const PIECES: readonly (readonly CellXY[])[] = [
  [
    [0, 0],
    [1, 0],
  ],
  [
    [0, 0],
    [0, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
];

/**
 * Pièces qui tombent : deux formes descendent d'une ligne par frappe, dans des colonnes
 * distinctes, la seconde en décalé. Orientation au hasard (elles peuvent « tomber » de côté).
 */
export const FALLING: PatternDef = {
  family: 'falling',
  minIntensity: 0.5,
  big: true,
  variants: (rng, difficulty) => {
    const speed = difficulty >= 0.8 ? 0.25 : 0.5;
    return range(6).map((v) => {
      const width = (piece: readonly CellXY[]) => Math.max(...piece.map(([x]) => x)) + 1;
      const a = PIECES[Math.floor(rng() * PIECES.length)];
      const wa = width(a);
      // Au moins une colonne reste libre : on n'est jamais obligé de traverser une pièce.
      const fits = PIECES.filter((p) => wa + width(p) <= 4);
      const b = fits[Math.floor(rng() * fits.length)];
      const wb = width(b);
      // Pièce A à gauche, pièce B à droite, sans chevauchement de colonnes.
      const xa = Math.floor(rng() * (5 - wa - wb + 1));
      const xb = xa + wa + Math.floor(rng() * (5 - xa - wa - wb + 1));
      const fall = (piece: readonly CellXY[], x0: number, delay: number) => {
        const h = Math.max(...piece.map(([, y]) => y)) + 1;
        const shape = single('piece', 'falling', piece.map(([x, y]) => [x + x0, y - h + 1] as const));
        return travel(shape, [0, 1], 5 + h - 1, speed).steps.map((s) => ({ ...s, beatOffset: s.beatOffset + delay }));
      };
      const p = merge(`falling-${v}`, 'falling', [fall(a, xa, 0), fall(b, xb, speed * 2)]);
      return rotate(p, Math.floor(rng() * 4));
    });
  },
};

function shuffledRange(rng: Rng): number[] {
  const out = range(5);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
