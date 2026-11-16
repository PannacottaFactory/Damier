import { describe, expect, it } from 'vitest';
import { humanModel, type Impact, isSurvivable, type SurvivabilityOptions } from '../src/patterns/survivability';

/** Options rondes pour des tests lisibles : réaction 0,25 s, 1 déplacement = 0,125 s, timing parfait. */
const OPTS: SurvivabilityOptions = { moveCost: 0.125, reaction: 0.25, timing: 0, gridSize: 5 };
const N = 5;
const idx = (x: number, y: number) => y * N + x;
const all = () => Array.from({ length: N * N }, (_, i) => i);
const row = (y: number) => [0, 1, 2, 3, 4].map((x) => idx(x, y));
const col = (x: number) => [0, 1, 2, 3, 4].map((y) => idx(x, y));
const checker = (parity: 0 | 1) => all().filter((i) => ((i % N) + Math.floor(i / N)) % 2 === parity);
const imp = (warnTime: number, time: number, cells: number[], duration = 0.1): Impact => ({ warnTime, time, duration, cells });

describe('isSurvivable (joueur humain simulé)', () => {
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
    expect(isSurvivable([imp(0, 0.375, row(2))], start, OPTS)).toBe(true); // 0,25 + 0,125
    expect(isSurvivable([imp(0, 0.35, row(2))], start, OPTS)).toBe(false);
  });

  it('une seule case sûre dans le coin opposé : il faut 8 déplacements', () => {
    const start = { x: 0, y: 0 };
    const cells = all().filter((i) => i !== idx(4, 4));
    expect(isSurvivable([imp(0, 0.25 + 8 * 0.125, cells)], start, OPTS)).toBe(true);
    expect(isSurvivable([imp(0, 0.25 + 7 * 0.125, cells)], start, OPTS)).toBe(false);
  });

  it('le temps compte à partir de l’apparition de l’avertissement, pas d’avant', () => {
    // Impact dans 10 s mais avertissement affiché seulement 0,3 s avant.
    expect(isSurvivable([imp(9.7, 10, row(2))], { x: 2, y: 2 }, OPTS)).toBe(false);
    // Avertissement déjà visible depuis 1 s : réaction déjà écoulée.
    expect(isSurvivable([imp(-1, 0.13, row(2))], { x: 2, y: 2 }, OPTS)).toBe(true);
  });

  it('pas de joueur devin : il ne peut pas anticiper un avertissement pas encore affiché', () => {
    const start = { x: 2, y: 2 };
    const leftSide = [...col(0), ...col(1)];
    const rightSide = [...col(3), ...col(4)];
    // La colonne 2 tombe : il faut aller à gauche ou à droite. Ensuite, un côté explose,
    // annoncé trop tard pour changer de côté. Un BFS « il existe un chemin » dirait oui
    // pour l'un des deux côtés ; un humain qui ne sait pas encore lequel peut se tromper.
    const trap = (side: number[]) => [imp(0, 1, col(2)), imp(1, 1.3, side)];
    const left = isSurvivable(trap(leftSide), start, OPTS);
    const right = isSurvivable(trap(rightSide), start, OPTS);
    expect(left && right).toBe(false);
    // Si le second avertissement arrive avant qu'il faille choisir, il choisit le bon côté.
    const early = (side: number[]) => [imp(0, 1, col(2)), imp(0, 1.3, side)];
    expect(isSurvivable(early(leftSide), start, OPTS)).toBe(true);
    expect(isSurvivable(early(rightSide), start, OPTS)).toBe(true);
  });

  it('on ne traverse pas une case mortelle : la case de départ est occupée pendant le pas', () => {
    const start = { x: 2, y: 2 };
    // Sa case explose longuement juste après qu'il a dû partir, la colonne ensuite.
    const longHit = imp(-5, 0.05, [idx(2, 2)], 0.5);
    expect(isSurvivable([longHit], start, OPTS)).toBe(false);
    expect(isSurvivable([{ ...longHit, time: 0.15 }], start, OPTS)).toBe(true);
  });

  it('tolérance de timing : refuse une esquive à faufiler dans un trou trop serré', () => {
    const start = { x: 2, y: 2 };
    // Sa case explose ; il doit passer par la case voisine juste après qu'elle a explosé.
    const seq = [imp(-5, 1, [idx(3, 2)], 0.1), imp(-5, 1.2, all().filter((i) => i !== idx(3, 2)))];
    expect(isSurvivable(seq, start, OPTS)).toBe(true);
    expect(isSurvivable(seq, start, { ...OPTS, timing: 0.06 })).toBe(false);
  });

  it('pluie : une goutte par double croche autour du joueur, annoncée à l’avance → jouable', () => {
    const start = { x: 2, y: 2 };
    const cells = [idx(2, 2), idx(1, 2), idx(3, 2), idx(2, 1), idx(2, 3), idx(2, 2)];
    const rain = cells.map((c, k) => imp(-2, 0.5 + 0.12 * k, [c], 0.06));
    expect(isSurvivable(rain, start, OPTS)).toBe(true);
  });

  it('damier alterné à chaque temps (128 BPM) : survivable par un joueur vif, pas par un joueur lent', () => {
    const beat = 60 / 128;
    const seq = [0, 1, 2, 3].map((k) => imp((k - 2) * beat + 1, k * beat + 1, checker((k % 2) as 0 | 1), beat / 4));
    expect(isSurvivable(seq, { x: 2, y: 2 }, humanModel(1))).toBe(true);
    // À demi-temps, il faudrait arriver dans un trou d'environ 0,1 s : trop précis pour un humain.
    const fast = [0, 1, 2, 3].map((k) => imp((k - 4) * beat * 0.5 + 1, k * beat * 0.5 + 1, checker((k % 2) as 0 | 1), beat / 4));
    expect(isSurvivable(fast, { x: 2, y: 2 }, humanModel(1))).toBe(false);
  });

  it('les impacts simultanés se cumulent', () => {
    const start = { x: 2, y: 2 };
    const halfA = all().filter((i) => i % N < 3);
    const halfB = all().filter((i) => i % N >= 3);
    expect(isSurvivable([imp(0, 5, halfA), imp(0, 5, halfB)], start, OPTS)).toBe(false);
    expect(isSurvivable([imp(0, 5, halfA), imp(0, 5.5, halfB)], start, OPTS)).toBe(true);
  });

  it('balayage ligne par ligne : on passe derrière la ligne', () => {
    const sweep = [0, 1, 2, 3, 4].map((y) => imp(y * 0.5 - 1, y * 0.5 + 0.5, row(y)));
    expect(isSurvivable(sweep, { x: 2, y: 2 }, OPTS)).toBe(true);
  });

  it('le joueur lent (sections calmes) est plus exigeant que le joueur vif', () => {
    const slow = humanModel(0);
    const fast = humanModel(1);
    expect(slow.reaction).toBeGreaterThan(fast.reaction);
    expect(slow.moveCost).toBeGreaterThan(fast.moveCost);
    const lineOnPlayer = [imp(0, fast.reaction + fast.moveCost + fast.timing + 0.02, row(2))];
    expect(isSurvivable(lineOnPlayer, { x: 2, y: 2 }, fast)).toBe(true);
    expect(isSurvivable(lineOnPlayer, { x: 2, y: 2 }, slow)).toBe(false);
  });
});
