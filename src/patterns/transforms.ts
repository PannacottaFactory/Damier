import { GRID_SIZE } from '../config';
import type { CellXY, Pattern, PatternStep } from './types';

/**
 * Transformations de patterns (fonctions pures, testées) :
 * rotation 90/180/270, miroir, inversion (cases sûres ↔ dangers), call & response.
 * Toutes renvoient un nouveau pattern avec un id suffixé, pour le debug.
 */

const N = GRID_SIZE;
const MAX = N - 1;

/** Toutes les cases du damier. */
export const ALL_CELLS: readonly CellXY[] = Array.from({ length: N * N }, (_, i) => [i % N, Math.floor(i / N)] as const);

function mapCells(p: Pattern, suffix: string, f: (c: CellXY) => CellXY): Pattern {
  return {
    ...p,
    id: `${p.id}${suffix}`,
    steps: p.steps.map((s) => ({ ...s, cells: s.cells.map(f) })),
  };
}

/** Rotation horaire d'un quart de tour, `quarterTurns` fois. */
export function rotate(p: Pattern, quarterTurns: number): Pattern {
  const q = ((quarterTurns % 4) + 4) % 4;
  if (q === 0) return p;
  const rot1 = ([x, y]: CellXY): CellXY => [MAX - y, x];
  return mapCells(p, `-r${q * 90}`, (c) => {
    let out = c;
    for (let i = 0; i < q; i++) out = rot1(out);
    return out;
  });
}

/** Miroir gauche ↔ droite. */
export function mirror(p: Pattern): Pattern {
  return mapCells(p, '-m', ([x, y]) => [MAX - x, y]);
}

/** Inversion : chaque étape fait exploser exactement les cases qu'elle épargnait. */
export function invert(p: Pattern): Pattern {
  return {
    ...p,
    id: `${p.id}-inv`,
    steps: p.steps.map((s) => ({ ...s, cells: complement(s.cells) })),
  };
}

export function complement(cells: readonly CellXY[]): CellXY[] {
  const set = new Set(cells.map(key));
  return ALL_CELLS.filter((c) => !set.has(key(c)));
}

/**
 * Call & response : le pattern est d'abord montré en avertissement seul (étapes fantômes),
 * puis rejoué pour de vrai `gapBeats` temps plus tard.
 */
export function callAndResponse(p: Pattern, gapBeats: number): Pattern {
  const call: PatternStep[] = p.steps.map((s) => ({ ...s, ghost: true }));
  const response: PatternStep[] = p.steps.map((s) => ({ ...s, beatOffset: s.beatOffset + gapBeats }));
  return { ...p, id: `${p.id}-cr`, steps: [...call, ...response] };
}

/** Translation ; les cases qui sortent du damier sont retirées (et les étapes vidées aussi). */
export function translate(p: Pattern, dx: number, dy: number): Pattern {
  return {
    ...p,
    id: `${p.id}-t${dx},${dy}`,
    steps: p.steps
      .map((s) => ({ ...s, cells: s.cells.map(([x, y]) => [x + dx, y + dy] as const).filter(inside) }))
      .filter((s) => s.cells.length > 0),
  };
}

/**
 * Déplacement : une forme (pattern à une étape) qui avance de `delta` case(s) toutes les
 * `spacing` temps, pendant `count` étapes. Les morceaux qui sortent du damier sont coupés.
 */
export function travel(shape: Pattern, delta: readonly [dx: number, dy: number], count: number, spacing: number): Pattern {
  const cells = shape.steps[0].cells;
  const steps: PatternStep[] = [];
  let first = -1;
  for (let k = 0; k < count; k++) {
    const moved = cells.map(([x, y]) => [x + delta[0] * k, y + delta[1] * k] as const).filter(inside);
    if (moved.length === 0) continue;
    // Si les premières positions sont hors du damier, le pattern démarre à sa première frappe visible.
    if (first < 0) first = k;
    steps.push({ beatOffset: (k - first) * spacing, cells: moved });
  }
  return { ...shape, id: `${shape.id}-mv${delta[0]},${delta[1]}`, steps };
}

/** Nombre maximal de frappes réelles reçues par une même case dans un pattern. */
export function maxHitsPerCell(p: Pattern): number {
  const hits = new Map<string, number>();
  for (const s of p.steps) if (!s.ghost) for (const c of s.cells) hits.set(key(c), (hits.get(key(c)) ?? 0) + 1);
  return Math.max(0, ...hits.values());
}

/** Les 8 symétries du carré (4 rotations × miroir), sans doublons. */
export function symmetries(p: Pattern): Pattern[] {
  const out: Pattern[] = [];
  for (const base of [p, mirror(p)]) for (let q = 0; q < 4; q++) out.push(rotate(base, q));
  return dedupe(out);
}

/** Retire les variantes qui produisent exactement les mêmes impacts. */
export function dedupe(patterns: readonly Pattern[]): Pattern[] {
  const seen = new Set<string>();
  return patterns.filter((p) => {
    const sig = signature(p);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

/** Signature canonique des impacts d'un pattern (ordre des cases indifférent). */
export function signature(p: Pattern): string {
  return p.steps
    .map((s) => `${s.beatOffset}${s.ghost ? 'g' : ''}:${s.cells.map(key).sort().join(',')}`)
    .join('|');
}

function inside([x, y]: CellXY): boolean {
  return x >= 0 && x < N && y >= 0 && y < N;
}

function key([x, y]: CellXY): string {
  return `${x}.${y}`;
}
