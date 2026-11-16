import type { Rng } from '../../core/random';
import { callAndResponse, dedupe, symmetries } from '../transforms';
import type { CellXY, PatternDef, PatternStep } from '../types';
import { checkerCells, columnCells, range, ringCells, rowCells, sequence, spiralOrder } from './shapes';

/**
 * Patterns en plusieurs temps. Règle de lisibilité : une case n'est jamais frappée
 * plus de 2 fois par le même pattern (vérifié par les tests).
 */

/**
 * Espacement entre deux frappes d'un pattern qui traverse le plateau : un temps.
 * Plus serré (demi-temps), il faut se faufiler derrière la ligne dans un trou d'environ 0,1 s :
 * le joueur simulé (réaction, imprécision de timing) n'y arrive pas — et un humain non plus.
 * La vitesse monte via d'autres patterns (pluie, comètes, pièces, spirale), pas en serrant les lignes.
 */
export function spacingsFor(_difficulty: number): number[] {
  return [1];
}

/** Damier puis damier inversé, puis encore : il faut changer de case à chaque beat. */
export const CHECKER: PatternDef = {
  family: 'checker',
  minIntensity: 0.5,
  big: true,
  variants: () =>
    ([0, 1] as const).map((first) =>
      sequence(
        `checker-${first}`,
        'checker',
        range(4).map((k) => ({ beatOffset: k, cells: checkerCells(((first + k) % 2) as 0 | 1) })),
      ),
    ),
};

/** Balayage : une ligne rouge traverse le plateau, temps par temps (plus vite quand ça chauffe). */
export const SWEEP: PatternDef = {
  family: 'sweep',
  minIntensity: 0.3,
  big: true,
  variants: (_rng, difficulty) =>
    dedupe(
      spacingsFor(difficulty).flatMap((speed) =>
        symmetries(
          sequence(
            `sweep-${speed}`,
            'sweep',
            range(5).map((y) => ({ beatOffset: y * speed, cells: rowCells(y) })),
          ),
        ),
      ),
    ),
};

/** Balayage en diagonale : une bande de 2 diagonales traverse le plateau, une bande par temps. */
export const DIAGONAL_SWEEP: PatternDef = {
  family: 'diagonal-sweep',
  minIntensity: 0.4,
  big: true,
  variants: () =>
    symmetries(
      sequence(
        'diag',
        'diagonal-sweep',
        range(5).map((k) => ({
          beatOffset: k,
          cells: [2 * k, 2 * k + 1].flatMap((d) =>
            range(5)
              .map((x) => [x, d - x] as const)
              .filter(([, y]) => y >= 0 && y < 5),
          ),
        })),
      ),
    ),
};

/** Pince : deux lignes partent des bords et se referment au centre (ou l'inverse). */
export const PINCER: PatternDef = {
  family: 'pincer',
  minIntensity: 0.3,
  big: true,
  variants: (_rng, difficulty) =>
    dedupe(
      spacingsFor(difficulty).flatMap((speed) => {
        const closing = [[0, 4], [1, 3], [2]].map((rows, k) => ({
          beatOffset: k * speed,
          cells: rows.flatMap(rowCells),
        }));
        const opening = [[2], [1, 3], [0, 4]].map((rows, k) => ({
          beatOffset: k * speed,
          cells: rows.flatMap(rowCells),
        }));
        return [
          ...symmetries(sequence(`pincer-in-${speed}`, 'pincer', closing)),
          ...symmetries(sequence(`pincer-out-${speed}`, 'pincer', opening)),
        ];
      }),
    ),
};

/** Rayures : une ligne sur deux, puis les autres. */
export const STRIPES: PatternDef = {
  family: 'stripes',
  minIntensity: 0.35,
  variants: () =>
    dedupe(
      ([0, 1] as const).flatMap((first) =>
        symmetries(
          sequence(`stripes-${first}`, 'stripes', [
            { beatOffset: 0, cells: [0, 1, 2, 3, 4].filter((y) => y % 2 === first).flatMap(rowCells) },
            { beatOffset: 1, cells: [0, 1, 2, 3, 4].filter((y) => y % 2 !== first).flatMap(rowCells) },
          ]),
        ),
      ),
    ),
};

/** Quadrants : les quatre coins 2×2 tombent en tournant, puis la croix centrale. */
export const QUADRANTS: PatternDef = {
  family: 'quadrants',
  minIntensity: 0.4,
  big: true,
  variants: (_rng, difficulty) => {
    const quad = (qx: number, qy: number): CellXY[] =>
      [0, 1].flatMap((dy) => [0, 1].map((dx) => [qx * 3 + dx, qy * 3 + dy] as const));
    const order = [quad(0, 0), quad(1, 0), quad(1, 1), quad(0, 1)];
    const middle = [...rowCells(2), ...columnCells(2).filter(([, y]) => y !== 2)];
    return dedupe(
      spacingsFor(difficulty).flatMap((speed) =>
        symmetries(
          sequence('quadrants', 'quadrants', [
            ...order.map((cells, k) => ({ beatOffset: k * speed, cells })),
            { beatOffset: 4 * speed, cells: middle },
          ]),
        ),
      ),
    );
  },
};

/** Anneaux qui respirent : contour, anneau intérieur, centre, puis retour vers l'extérieur. */
export const RINGS: PatternDef = {
  family: 'rings',
  minIntensity: 0.45,
  big: true,
  variants: () => [
    sequence('rings-in-out', 'rings', [0, 1, 2, 1, 0].map((d, k) => ({ beatOffset: k, cells: ringCells(d) }))),
    sequence('rings-out-in', 'rings', [2, 1, 0, 1, 2].map((d, k) => ({ beatOffset: k, cells: ringCells(d) }))),
  ],
};

/**
 * Spirale qui se referme : une tête de 3 cases parcourt la spirale vers le centre,
 * chaque case n'explose qu'une fois. On l'esquive en passant derrière elle ; le centre est sûr.
 */
export const SPIRAL: PatternDef = {
  family: 'spiral',
  minIntensity: 0.55,
  big: true,
  variants: (_rng, difficulty) => {
    const order = spiralOrder().slice(0, -1);
    const perStep = difficulty >= 0.9 ? 3 : 2;
    return dedupe(
      [0.25, 0.5].flatMap((speed) =>
        symmetries(
          sequence(
            `spiral-${speed}`,
            'spiral',
            range(Math.ceil(order.length / perStep)).map((k) => ({
              beatOffset: k * speed,
              cells: order.slice(k * perStep, (k + 1) * perStep),
            })),
          ),
        ),
      ),
    );
  },
};

/** Ligne ou colonne au hasard. */
function randomLine(rng: Rng): { id: string; cells: CellXY[] } {
  const i = Math.floor(rng() * 5);
  const vertical = rng() < 0.5;
  return { id: `${vertical ? 'c' : 'r'}${i}`, cells: vertical ? columnCells(i) : rowCells(i) };
}

/**
 * Call & response : un motif rythmique de lignes est d'abord montré (avertissement seul),
 * puis rejoué pour de vrai une mesure plus tard.
 */
const CALL_RHYTHMS: readonly (readonly number[])[] = [
  [0, 1, 2],
  [0, 0.75, 1.5],
  [0, 1, 1.5, 2],
  [0, 0.5, 1.5],
  [0, 0.5, 1, 1.5],
];

export const CALL_RESPONSE: PatternDef = {
  family: 'call-response',
  minIntensity: 0.45,
  big: true,
  variants: (rng) =>
    range(6).map((v) => {
      const rhythm = CALL_RHYTHMS[Math.floor(rng() * CALL_RHYTHMS.length)];
      // Lignes toutes différentes, et jamais plus de 2 frappes sur une même case.
      const used = new Set<string>();
      const hits = new Map<string, number>();
      const motif: PatternStep[] = [];
      for (const beatOffset of rhythm) {
        for (let tries = 0; tries < 50; tries++) {
          const line = randomLine(rng);
          if (used.has(line.id) || line.cells.some((c) => (hits.get(`${c}`) ?? 0) >= 2)) continue;
          used.add(line.id);
          for (const c of line.cells) hits.set(`${c}`, (hits.get(`${c}`) ?? 0) + 1);
          motif.push({ beatOffset, cells: line.cells });
          break;
        }
      }
      return callAndResponse({ id: `motif${v}`, family: 'call-response', steps: motif }, 4);
    }),
};
