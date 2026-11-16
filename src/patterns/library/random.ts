import type { Rng } from '../../core/random';
import { complement } from '../transforms';
import type { CellXY, PatternDef, PatternStep } from '../types';
import { neighbors, range, sameCell } from './shapes';

/**
 * Patterns tirés au hasard à chaque utilisation (le director en génère plusieurs
 * et garde le premier jugé survivable depuis la position du joueur).
 */

const randCell = (rng: Rng): CellXY => [Math.floor(rng() * 5), Math.floor(rng() * 5)];
const pickOne = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

/** Chemin auto-évitant (ne repasse jamais par la même case) ; null si coincé. */
function selfAvoidingPath(rng: Rng, length: number): CellXY[] | null {
  const path = [randCell(rng)];
  while (path.length < length) {
    const options = neighbors(path[path.length - 1]).filter((c) => !path.some((p) => sameCell(p, c)));
    if (options.length === 0) return null;
    path.push(pickOne(rng, options));
  }
  return path;
}

/**
 * Case sûre qui saute : tout explose sauf une case, puis tout sauf une case voisine (à 1 ou 2 pas).
 * Deux frappes seulement : au-delà, le plateau entier clignote et ça devient illisible.
 */
export const FOLLOW: PatternDef = {
  family: 'follow',
  minIntensity: 0.6,
  big: true,
  variants: (rng) =>
    range(6).map((v) => {
      const a = randCell(rng);
      const near = neighbors(a);
      const b = rng() < 0.5 ? pickOne(rng, near) : pickOne(rng, neighbors(pickOne(rng, near)).filter((c) => !sameCell(c, a)));
      return {
        id: `follow-${v}`,
        family: 'follow',
        steps: [
          { beatOffset: 0, cells: complement([a]) },
          { beatOffset: 1, cells: complement([b]) },
        ],
      };
    }),
};

/**
 * Serpent : un chemin sûr qui serpente apparaît (tout le reste explose), puis le serpent
 * est mangé depuis la queue, case par case : il faut remonter jusqu'à sa tête.
 */
export const SNAKE: PatternDef = {
  family: 'snake',
  minIntensity: 0.5,
  big: true,
  variants: (rng, difficulty) => {
    const speed = difficulty >= 0.8 ? 0.25 : 0.5;
    const out = [];
    for (let v = 0; out.length < 5 && v < 40; v++) {
      const path = selfAvoidingPath(rng, 9);
      if (!path) continue;
      const steps: PatternStep[] = [
        { beatOffset: 0, cells: complement(path) },
        // La queue est mangée à partir du temps suivant ; les 2 cases de tête restent sûres.
        ...path.slice(0, -2).map((c, k) => ({ beatOffset: 1 + k * speed, cells: [c] })),
      ];
      out.push({ id: `snake-${out.length}`, family: 'snake', steps });
    }
    return out;
  },
};

/** Pluie : des cases au hasard sur les doubles croches, plus dense avec l'intensité. */
export const RAIN: PatternDef = {
  family: 'rain',
  minIntensity: 0.7,
  sections: ['DROP', 'DROP2'],
  variants: (rng, difficulty) => {
    const density = Math.min(0.85, 0.35 + 0.4 * difficulty);
    return range(4).map((v) => {
      const steps: PatternStep[] = [];
      const recent: CellXY[] = [];
      const hits = new Map<string, number>();
      for (let i = 0; i < 16; i++) {
        if (i > 0 && rng() > density) continue;
        let cell: CellXY;
        // Jamais la même case que les deux dernières gouttes, et 2 gouttes max par case.
        do cell = randCell(rng);
        while (recent.some((c) => sameCell(c, cell)) || (hits.get(`${cell}`) ?? 0) >= 2);
        hits.set(`${cell}`, (hits.get(`${cell}`) ?? 0) + 1);
        recent.push(cell);
        if (recent.length > 2) recent.shift();
        steps.push({ beatOffset: i * 0.25, cells: [cell] });
      }
      return { id: `rain-${v}`, family: 'rain', steps };
    });
  },
};
