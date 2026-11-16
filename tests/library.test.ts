import { describe, expect, it } from 'vitest';
import { GRID_SIZE } from '../src/config';
import { TempoMap } from '../src/core/clock';
import { createRng } from '../src/core/random';
import { instantiate, toImpacts } from '../src/patterns/director';
import { LIBRARY } from '../src/patterns/library';
import { spiralOrder } from '../src/patterns/library/shapes';
import { isSurvivable } from '../src/patterns/survivability';
import {
  callAndResponse,
  complement,
  invert,
  maxHitsPerCell,
  mirror,
  rotate,
  signature,
  symmetries,
  translate,
  travel,
} from '../src/patterns/transforms';
import type { Pattern } from '../src/patterns/types';

const one = (cells: [number, number][]): Pattern => ({ id: 'p', family: 'f', steps: [{ beatOffset: 0, cells }] });
const cellsOf = (p: Pattern, step = 0) =>
  p.steps[step].cells.map(([x, y]) => `${x},${y}`).sort();

describe('transformations', () => {
  const corner = one([[0, 0], [1, 0]]);

  it('rotation horaire d’un quart de tour', () => {
    expect(cellsOf(rotate(corner, 1))).toEqual(['4,0', '4,1']);
    expect(cellsOf(rotate(corner, 2))).toEqual(['3,4', '4,4']);
    expect(cellsOf(rotate(corner, 3))).toEqual(['0,3', '0,4']);
  });

  it('4 quarts de tour = identité, rotation négative = sens inverse', () => {
    expect(signature(rotate(rotate(corner, 3), 1))).toBe(signature(corner));
    expect(signature(rotate(corner, -1))).toBe(signature(rotate(corner, 3)));
    expect(rotate(corner, 4)).toBe(corner);
  });

  it('miroir gauche ↔ droite, involutif', () => {
    expect(cellsOf(mirror(corner))).toEqual(['3,0', '4,0']);
    expect(signature(mirror(mirror(corner)))).toBe(signature(corner));
  });

  it('inversion : complément exact, involutive', () => {
    const inv = invert(corner);
    expect(inv.steps[0].cells).toHaveLength(GRID_SIZE * GRID_SIZE - 2);
    expect(cellsOf(inv)).not.toContain('0,0');
    expect(signature(invert(inv))).toBe(signature(corner));
    expect(complement([])).toHaveLength(25);
  });

  it('symétries : 8 au plus, doublons retirés', () => {
    expect(symmetries(corner)).toHaveLength(8);
    // Une ligne de bord : 4 orientations distinctes (haut, droite, bas, gauche).
    expect(symmetries(one([0, 1, 2, 3, 4].map((x) => [x, 0])))).toHaveLength(4);
    // La case centrale est invariante.
    expect(symmetries(one([[2, 2]]))).toHaveLength(1);
  });

  it('call & response : étapes fantômes puis rejouées pour de vrai', () => {
    const p: Pattern = { id: 'm', family: 'f', steps: [{ beatOffset: 0, cells: [[0, 0]] }, { beatOffset: 1, cells: [[1, 1]] }] };
    const cr = callAndResponse(p, 4);
    expect(cr.steps.map((s) => [s.beatOffset, !!s.ghost])).toEqual([
      [0, true],
      [1, true],
      [4, false],
      [5, false],
    ]);
  });

  it('translation : décale et coupe ce qui sort du damier', () => {
    expect(cellsOf(translate(corner, 1, 2))).toEqual(['1,2', '2,2']);
    expect(cellsOf(translate(corner, -1, 0))).toEqual(['0,0']);
    expect(translate(corner, 0, -1).steps).toHaveLength(0);
  });

  it('déplacement : la forme avance d’une case par frappe, recalée sur sa première frappe visible', () => {
    const m = travel(one([[0, 0]]), [1, 0], 5, 0.5);
    expect(m.steps.map((s) => [s.beatOffset, `${s.cells[0]}`])).toEqual([
      [0, '0,0'],
      [0.5, '1,0'],
      [1, '2,0'],
      [1.5, '3,0'],
      [2, '4,0'],
    ]);
    // Départ hors du damier : la première frappe visible tombe sur le temps 0.
    const entering = travel(one([[0, -2]]), [0, 1], 4, 1);
    expect(entering.steps.map((s) => [s.beatOffset, `${s.cells[0]}`])).toEqual([
      [0, '0,0'],
      [1, '0,1'],
    ]);
  });

  it('frappes par case : les fantômes ne comptent pas', () => {
    const p: Pattern = { id: 'm', family: 'f', steps: [{ beatOffset: 0, cells: [[0, 0]] }, { beatOffset: 1, cells: [[0, 0]] }] };
    expect(maxHitsPerCell(p)).toBe(2);
    expect(maxHitsPerCell(callAndResponse(one([[0, 0]]), 4))).toBe(1);
  });

  it('spirale : parcourt les 25 cases une seule fois et finit au centre', () => {
    const order = spiralOrder();
    expect(new Set(order.map(([x, y]) => `${x},${y}`)).size).toBe(25);
    expect(order[order.length - 1]).toEqual([2, 2]);
  });
});

describe('bibliothèque', () => {
  const tempo = new TempoMap(128, 0);
  const START = 8;
  const familySet = new Set(LIBRARY.map((d) => d.family));

  it('familles uniques, toutes celles du cahier des charges', () => {
    expect(familySet.size).toBe(LIBRARY.length);
    for (const f of ['line', 'double-line', 'cross', 'x', 'border', 'center', 'checker', 'sweep', 'spiral', 'follow', 'snake', 'rain', 'call-response', 'moving-block', 'moving-cross', 'train', 'comets', 'falling']) {
      expect(familySet.has(f), f).toBe(true);
    }
  });

  for (const def of LIBRARY) {
    describe(def.family, () => {
      for (const difficulty of [def.minIntensity, 1.2]) {
        it(`variantes valides et survivables (difficulté ${difficulty})`, () => {
          for (let seed = 1; seed <= 5; seed++) {
            const variants = def.variants(createRng(seed), difficulty);
            expect(variants.length).toBeGreaterThan(0);
            let fromCenter = 0;
            for (const p of variants) {
              expect(p.family).toBe(def.family);
              expect(p.steps[0].beatOffset).toBe(0);
              // Lisibilité : une case n'est jamais frappée plus de 2 fois par un même pattern.
              expect(maxHitsPerCell(p), `${p.id} : frappes par case`).toBeLessThanOrEqual(2);
              for (const s of p.steps) {
                expect(s.beatOffset % 0.25, `${p.id} : sur la grille des doubles croches`).toBe(0);
                expect(s.cells.length).toBeGreaterThan(0);
                if (!s.ghost) expect(s.cells.length, `${p.id} : jamais tout le plateau`).toBeLessThan(25);
                for (const [x, y] of s.cells) {
                  expect(x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE, `${p.id} : (${x}, ${y})`).toBe(true);
                }
              }
              // Joué seul au niveau 1 : survivable depuis au moins une case de départ.
              const impacts = toImpacts(instantiate(p, START, 2), tempo, 0);
              let any = false;
              for (let i = 0; i < 25 && !any; i++) any = isSurvivable(impacts, { x: i % 5, y: Math.floor(i / 5) });
              expect(any, `${p.id} : survivable depuis au moins une case`).toBe(true);
              if (isSurvivable(impacts, { x: 2, y: 2 })) fromCenter++;
            }
            expect(fromCenter, 'au moins une variante jouable depuis le centre').toBeGreaterThan(0);
          }
        });
      }
    });
  }
});
