import { GRID_SIZE, MOVE_COST_MS, REACTION_MS } from '../config';
import type { Cell } from '../game/grid';

/**
 * Vérification d'équité : existe-t-il une façon de survivre à une suite d'impacts,
 * pour un humain qui ne réagit qu'aux avertissements qu'il voit ?
 *
 * Modèle :
 * - Pour un impact, le joueur ne peut commencer à bouger qu'après `warnTime + reaction`
 *   (il doit avoir vu l'avertissement), et pas pendant qu'un impact précédent est en cours.
 * - Chaque déplacement coûte `moveCost` secondes (appui + tween).
 * - On propage par BFS l'ensemble des cases atteignables (rester sur place est permis),
 *   puis on retire les cases qui explosent. Ensemble vide → insurvivable.
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
  /** Temps de réaction (s). */
  reaction: number;
  gridSize: number;
}

export const DEFAULT_SURVIVABILITY: SurvivabilityOptions = {
  moveCost: MOVE_COST_MS / 1000,
  reaction: REACTION_MS / 1000,
  gridSize: GRID_SIZE,
};

/** Tolérance flottante sur le nombre de déplacements. */
const EPS = 1e-6;

export function isSurvivable(
  impacts: readonly Impact[],
  playerPos: Cell,
  opts: SurvivabilityOptions = DEFAULT_SURVIVABILITY,
): boolean {
  const n = opts.gridSize;
  const groups = groupByTime(impacts);
  let reachable = new Set<number>([playerPos.y * n + playerPos.x]);
  /** Instant à partir duquel le joueur est libre de bouger (fin du dernier impact). */
  let freeFrom = 0;

  for (const g of groups) {
    const startMoving = Math.max(freeFrom, g.warnTime + opts.reaction);
    const moves = Math.max(0, Math.floor((g.time - startMoving) / opts.moveCost + EPS));
    reachable = expand(reachable, moves, n);
    for (const c of g.cells) reachable.delete(c);
    if (reachable.size === 0) return false;
    freeFrom = Math.max(freeFrom, g.time + g.duration);
  }
  return true;
}

/** Fusionne les impacts simultanés (même instant) : leurs cases s'additionnent. */
function groupByTime(impacts: readonly Impact[]): Impact[] {
  const sorted = [...impacts].sort((a, b) => a.time - b.time);
  const out: { warnTime: number; time: number; duration: number; cells: Set<number> }[] = [];
  for (const imp of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.time - imp.time) < 1e-6) {
      // Avertissement le plus tardif : c'est lui qui limite le temps de réaction.
      last.warnTime = Math.max(last.warnTime, imp.warnTime);
      last.duration = Math.max(last.duration, imp.duration);
      for (const c of imp.cells) last.cells.add(c);
    } else {
      out.push({ ...imp, cells: new Set(imp.cells) });
    }
  }
  return out.map((g) => ({ ...g, cells: [...g.cells] }));
}

/** Cases atteignables en au plus `moves` déplacements orthogonaux (BFS multi-sources). */
function expand(from: Set<number>, moves: number, n: number): Set<number> {
  const seen = new Set(from);
  let frontier = [...from];
  for (let m = 0; m < moves && frontier.length > 0 && seen.size < n * n; m++) {
    const next: number[] = [];
    for (const c of frontier) {
      const x = c % n;
      const y = (c - x) / n;
      const neighbors = [x > 0 ? c - 1 : -1, x < n - 1 ? c + 1 : -1, y > 0 ? c - n : -1, y < n - 1 ? c + n : -1];
      for (const i of neighbors) {
        if (i >= 0 && !seen.has(i)) {
          seen.add(i);
          next.push(i);
        }
      }
    }
    frontier = next;
  }
  return seen;
}
