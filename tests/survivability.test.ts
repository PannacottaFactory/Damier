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

  it('pendant un impact, on bouge mais sans traverser les cases mortelles', () => {
    const start = { x: 2, y: 2 };
    // Ligne 2 mortelle de 0 à 0,5 s (sauf la case du joueur) ; la colonne 2 tombe ensuite.
    const a = imp(-5, 0, row(2).filter((i) => i !== idx(2, 2)), 0.5);
    const col2 = [0, 1, 2, 3, 4].map((y) => idx(2, y));
    // Sans la ligne, 1 déplacement latéral suffit…
    expect(isSurvivable([imp(-5, 0.15, col2)], start, OPTS)).toBe(true);
    // …mais la ligne bloque le chemin direct : en 1 déplacement on reste sur la colonne.
    expect(isSurvivable([a, imp(-5, 0.15, col2)], start, OPTS)).toBe(false);
    // Le détour (haut puis côté) prend 2 déplacements.
    expect(isSurvivable([a, imp(-5, 0.25, col2)], start, OPTS)).toBe(true);
  });

  it('le temps restant se reporte : la pluie (une case par double croche) reste jouable', () => {
    const start = { x: 2, y: 2 };
    // La case du joueur puis ses voisines tombent toutes les 0,12 s, annoncées longtemps à l'avance.
    const cells = [idx(2, 2), idx(1, 2), idx(3, 2), idx(2, 1), idx(2, 3), idx(2, 2)];
    const rain = cells.map((c, k) => imp(-2, 0.5 + 0.12 * k, [c], 0.06));
    expect(isSurvivable(rain, start, OPTS)).toBe(true);
  });

  it('damier alterné à chaque temps (128 BPM) : survivable', () => {
    const beat = 60 / 128;
    const seq = [0, 1, 2, 3].map((k) => imp((k - 2) * beat, k * beat + 1, checker((k % 2) as 0 | 1), beat / 4));
    expect(isSurvivable(seq, { x: 2, y: 2 }, OPTS)).toBe(true);
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
