import {
  GRID_SIZE,
  HUMAN_MOVE_MS_EASY,
  HUMAN_MOVE_MS_HARD,
  HUMAN_REACTION_MS_EASY,
  HUMAN_REACTION_MS_HARD,
  HUMAN_TIMING_MS_EASY,
  HUMAN_TIMING_MS_HARD,
} from '../config';
import type { Cell } from '../game/grid';

/**
 * Vérification d'équité : un humain qui ne voit QUE les avertissements affichés
 * survivrait-il à cette suite d'impacts ?
 *
 * Pourquoi une simulation et pas un simple BFS « existe-t-il un chemin » :
 * un BFS sur l'ensemble des cases atteignables suppose un joueur devin, qui se trouve
 * par chance sur la bonne case AVANT d'avoir vu l'avertissement suivant. Dans les patterns
 * en plusieurs temps, ça validait des enchaînements quasi impossibles.
 *
 * Modèle du joueur (simulé au 1/64 s) :
 * - il ne connaît un impact qu'à `warnTime + reaction` (le temps de voir et de comprendre) ;
 * - à chaque nouvelle information, il recalcule, sur ce qu'il connaît seulement,
 *   les positions d'où l'on peut encore survivre (programmation dynamique à rebours sur
 *   (case, instant), un BFS dans le temps) ;
 * - il est paresseux : il reste sur place tant que c'est sûr ; sinon il fait le pas qui
 *   garde une issue, en préférant se rapprocher du centre (plus de sorties) ;
 * - un déplacement prend `moveCost` (appui + tween) ; pendant ce temps il occupe encore
 *   sa case de départ (prudent) ;
 * - il n'est pas précis à la milliseconde : chaque impact est élargi de `timing` avant et
 *   après. Une esquive qui demande de se faufiler dans un trou de 50 ms est refusée ;
 * - le verdict se fait sur la RÉALITÉ : s'il se trouve sur une case au moment où elle
 *   est mortelle, c'est perdu.
 *
 * Les temps sont en secondes, relatifs à « maintenant » (0). Un avertissement déjà
 * visible a un `warnTime` négatif.
 */
export interface Impact {
  /** Début de l'avertissement (secondes). */
  warnTime: number;
  /** Début de l'impact (secondes). */
  time: number;
  /** Durée de l'impact (secondes). */
  duration: number;
  /** Index des cases touchées (y * taille + x). */
  cells: readonly number[];
}

export interface SurvivabilityOptions {
  /** Coût d'un déplacement (s). */
  moveCost: number;
  /** Temps de réaction à un nouvel avertissement (s). */
  reaction: number;
  /** Imprécision de timing tolérée (s) : marge ajoutée avant et après chaque impact. */
  timing: number;
  gridSize: number;
}

/**
 * Modèle humain selon la difficulté : dans les sections calmes on n'accepte que des patterns
 * confortables (joueur lent), dans les drops on exige un joueur vif. C'est aussi ce qui fait
 * monter la difficulté, sans jamais devenir injuste.
 */
export function humanModel(difficulty: number): SurvivabilityOptions {
  const t = Math.min(1, Math.max(0, difficulty));
  return {
    timing: (HUMAN_TIMING_MS_EASY + (HUMAN_TIMING_MS_HARD - HUMAN_TIMING_MS_EASY) * t) / 1000,
    reaction: (HUMAN_REACTION_MS_EASY + (HUMAN_REACTION_MS_HARD - HUMAN_REACTION_MS_EASY) * t) / 1000,
    moveCost: (HUMAN_MOVE_MS_EASY + (HUMAN_MOVE_MS_HARD - HUMAN_MOVE_MS_EASY) * t) / 1000,
    gridSize: GRID_SIZE,
  };
}

/** Le joueur le plus vif qu'on suppose (difficulté maximale). */
export const DEFAULT_SURVIVABILITY: SurvivabilityOptions = humanModel(1);

/** Pas de simulation (s). */
const TICK = 1 / 64;

export function isSurvivable(
  impacts: readonly Impact[],
  playerPos: Cell,
  opts: SurvivabilityOptions = DEFAULT_SURVIVABILITY,
): boolean {
  const n = opts.gridSize;
  if (n * n > 31) throw new Error('isSurvivable : damier trop grand pour les masques 32 bits');
  if (impacts.length === 0) return true;

  const geo = geometry(n);
  const M = Math.max(1, Math.ceil(opts.moveCost / TICK - 1e-9));
  // Impacts en ticks : intervalle mortel élargi de la marge de timing, arrondi vers l'extérieur.
  const list = impacts.map((imp) => ({
    known: Math.max(0, Math.ceil((imp.warnTime + opts.reaction) / TICK - 1e-9)),
    from: Math.max(0, Math.floor((imp.time - opts.timing) / TICK + 1e-9)),
    to: Math.max(0, Math.ceil((imp.time + imp.duration + opts.timing) / TICK - 1e-9)),
    mask: imp.cells.reduce((m, c) => m | (1 << c), 0),
  }));
  const horizon = Math.max(...list.map((i) => i.to)) + 1;

  /** Cases mortelles à chaque tick, réalité (tous les impacts). */
  const lethalReal = lethalTable(list, horizon, () => true);
  const knowTimes = [...new Set(list.map((i) => i.known))].sort((a, b) => a - b);

  let cell = playerPos.y * n + playerPos.x;
  let arrival = 0; // tick d'arrivée du déplacement en cours
  let target = cell;
  let plan: Plan | null = null;
  let k = 0;

  for (let t = 0; t <= horizon; t++) {
    // Nouvelle information visible → on replanifie.
    if (k < knowTimes.length && knowTimes[k] <= t) {
      while (k < knowTimes.length && knowTimes[k] <= t) k++;
      const lethalKnown = lethalTable(list, horizon, (i) => i.known <= t);
      plan = planTable(lethalKnown, horizon, M, geo);
    }
    if (t >= arrival) cell = target;
    if (lethalReal[t] & (1 << cell)) return false;
    if (t < arrival || !plan) continue;

    // Décision (joueur immobile) : rester si c'est sûr, sinon le meilleur pas qui garde une issue.
    const bit = 1 << cell;
    if (t + 1 > horizon || (plan.safe[t + 1] & bit) !== 0) continue;
    if (plan.window[t] & bit) continue; // départ impossible sans être touché : on subit
    const reach = t + M > horizon ? geo.all : plan.safe[t + M];
    let best = -1;
    let bestDist = Infinity;
    for (const d of geo.neighbors[cell]) {
      if (!(reach & (1 << d))) continue;
      if (geo.centerDist[d] < bestDist) {
        best = d;
        bestDist = geo.centerDist[d];
      }
    }
    if (best >= 0) {
      target = best;
      arrival = t + M;
    }
  }
  return true;
}

interface Geometry {
  all: number;
  neighbors: number[][];
  centerDist: number[];
  /** Masques pour décaler un ensemble de cases d'une case (sans débordement de ligne). */
  notCol0: number;
  notColLast: number;
  n: number;
}

const geoCache = new Map<number, Geometry>();
function geometry(n: number): Geometry {
  const cached = geoCache.get(n);
  if (cached) return cached;
  let all = 0;
  let col0 = 0;
  let colLast = 0;
  const neighbors: number[][] = [];
  const centerDist: number[] = [];
  const c = (n - 1) / 2;
  for (let i = 0; i < n * n; i++) {
    const x = i % n;
    const y = Math.floor(i / n);
    all |= 1 << i;
    if (x === 0) col0 |= 1 << i;
    if (x === n - 1) colLast |= 1 << i;
    neighbors.push(
      [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1].filter((v) => v >= 0),
    );
    centerDist.push(Math.abs(x - c) + Math.abs(y - c));
  }
  const g = { all, neighbors, centerDist, notCol0: all & ~col0, notColLast: all & ~colLast, n };
  geoCache.set(n, g);
  return g;
}

/** Cases ayant au moins un voisin dans `set`. */
function grow(set: number, g: Geometry): number {
  return (
    (((set << 1) & g.notCol0) | ((set >>> 1) & g.notColLast) | (set << g.n) | (set >>> g.n)) & g.all
  );
}

function lethalTable(
  list: readonly { known: number; from: number; to: number; mask: number }[],
  horizon: number,
  include: (i: { known: number }) => boolean,
): Int32Array {
  const table = new Int32Array(horizon + 2);
  for (const i of list) {
    if (!include(i)) continue;
    for (let t = i.from; t < i.to && t <= horizon; t++) table[t] |= i.mask;
  }
  return table;
}

interface Plan {
  /** safe[t] : cases où l'on peut se trouver (immobile) au tick t et survivre aux impacts connus. */
  safe: Int32Array;
  /** window[t] : cases mortelles quelque part sur [t, t+M) (on ne peut pas partir sans être touché). */
  window: Int32Array;
}

/**
 * Positions sûres, à rebours (BFS dans le temps) :
 *   - rester : la case est sûre au tick t+1 ;
 *   - partir vers un voisin : la case de départ n'est pas mortelle sur [t, t+M)
 *     et le voisin est sûr au tick t+M.
 */
function planTable(lethal: Int32Array, horizon: number, M: number, g: Geometry): Plan {
  const safe = new Int32Array(horizon + 2);
  const window = new Int32Array(horizon + 2);
  for (let t = horizon; t >= 0; t--) {
    let w = 0;
    for (let d = 0; d < M && t + d <= horizon; d++) w |= lethal[t + d];
    window[t] = w;
  }
  safe[horizon + 1] = g.all;
  safe[horizon] = g.all & ~lethal[horizon];
  for (let t = horizon - 1; t >= 0; t--) {
    const later = t + M > horizon ? g.all : safe[t + M];
    const move = grow(later, g) & ~window[t];
    safe[t] = ~lethal[t] & (safe[t + 1] | move) & g.all;
  }
  return { safe, window };
}
