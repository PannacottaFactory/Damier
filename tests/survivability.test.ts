import { describe, expect, it } from 'vitest';
import { type Impact, isSurvivable, type SurvivabilityOptions } from '../src/patterns/survivability';

/** Options rondes pour des tests lisibles : réaction 0,2 s, 1 déplacement = 0,1 s. */
const OPTS: SurvivabilityOptions = { moveCost: 0.1, reaction: 0.2, gridSize: 5 };
const N = 5;
const idx = (x: number, y: number) => y * N + x;
const all = () => Array.from({ length: N * N }, (_, i) => i);
const row = (y: number) => [0, 1, 2, 3, 4].map((x) => idx(x, y));
const checker = (parity: 0 | 1) => all().filter((i) => ((i % N) + Math.floor(i / N)) % 2 === parity);
const imp = (warnTime: number, time: number, cells: number[], duration = 0.1): Impact => ({ warnTime, time, duration, cells });

describe('isSurvivable', () => {
  it('aucun impact → survivable', () => {
    expect(isSurvivable([], { x: 2, y: 2 }, OPTS)).toBe(true);
  });

  it('impact loin du joueur → survivable même sans temps pour bouger', () => {
    expect(isSurvivable([imp(0, 0, row(0))], { x: 2, y: 2 }, OPTS)).toBe(true);
  });

  it('tout le plateau explose → jamais survivable', () => {
    expect(isSurvivable([imp(0, 10, all())], { x: 2, y: 2 }, OPTS)).toBe(false);
  });

  it('ligne sur le joueur : il faut le temps de réagir + 1 déplacement', () => {
    const start = { x: 2, y: 2 };
    expect(isSurvivable([imp(0, 0.3, row(2))], start, OPTS)).toBe(true); // 0,2 réaction + 0,1
    expect(isSurvivable([imp(0, 0.29, row(2))], start, OPTS)).toBe(false);
  });

  it('une seule case sûre dans le coin opposé : il faut 8 déplacements', () => {
    const start = { x: 0, y: 0 };
    const cells = all().filter((i) => i !== idx(4, 4));
    expect(isSurvivable([imp(0, 0.2 + 0.8, cells)], start, OPTS)).toBe(true);
    expect(isSurvivable([imp(0, 0.2 + 0.7, cells)], start, OPTS)).toBe(false);
  });

  it('le temps compte à partir de l’apparition de l’avertissement, pas d’avant', () => {
    // Impact dans 10 s mais avertissement affiché seulement 0,25 s avant.
    expect(isSurvivable([imp(9.75, 10, row(2))], { x: 2, y: 2 }, OPTS)).toBe(false);
    // Avertissement déjà visible depuis 1 s : réaction déjà écoulée.
    expect(isSurvivable([imp(-1, 0.1, row(2))], { x: 2, y: 2 }, OPTS)).toBe(true);
  });

  it('damier puis damier inversé : survivable si on a le temps d’1 pas entre les deux', () => {
    const start = { x: 2, y: 2 }; // parité 0
    const seq = (gap: number) => [imp(0, 0.5, checker(0)), imp(0.5 - 0.3 + gap, 0.5 + gap, checker(1))];
    // Le 2e avertissement apparaît 0,3 s avant son impact ; pendant le 1er impact (0,1 s) on ne bouge pas.
    expect(isSurvivable(seq(0.3), start, OPTS)).toBe(true);
    // Impact immédiatement après le premier : pas le temps.
    expect(isSurvivable(seq(0.1), start, OPTS)).toBe(false);
  });

  it('on ne bouge pas pendant un impact : les déplacements reprennent à sa fin', () => {
    const start = { x: 2, y: 2 };
    // 1er impact long (0,5 s) ailleurs, 2e impact sur le joueur juste après.
    const a = imp(-5, 0, row(0), 0.5);
    const b = imp(-5, 0.55, row(2));
    expect(isSurvivable([a, b], start, OPTS)).toBe(false); // 0,05 s libre < 0,1
    expect(isSurvivable([a, { ...b, time: 0.6 }], start, OPTS)).toBe(true);
  });

  it('les impacts simultanés se cumulent', () => {
    const start = { x: 2, y: 2 };
    const halfA = all().filter((i) => i % N < 3);
    const halfB = all().filter((i) => i % N >= 3);
    expect(isSurvivable([imp(0, 5, halfA), imp(0, 5, halfB)], start, OPTS)).toBe(false);
    expect(isSurvivable([imp(0, 5, halfA), imp(0, 5.5, halfB)], start, OPTS)).toBe(true);
  });

  it('balayage ligne par ligne : on suit le plateau', () => {
    const start = { x: 2, y: 0 };
    const sweep = [0, 1, 2, 3, 4].map((y) => imp(y * 0.5 - 1, y * 0.5 + 0.5, row(y)));
    expect(isSurvivable(sweep, start, OPTS)).toBe(true);
  });
});
