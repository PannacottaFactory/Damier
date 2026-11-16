import {
  BUMP_DISTANCE,
  BUMP_MS,
  HITBOX_SWITCH_RATIO,
  INPUT_BUFFER_SIZE,
  MOVE_TWEEN_MS,
} from '../config';
import { CENTER, type Cell, type Dir, DIR_VECTORS, inBounds, neighbor } from './grid';

/**
 * Joueur : position logique + tween + buffer d'input.
 *
 * Tous les temps sont en secondes, dans le référentiel de l'horloge du jeu
 * (à l'étape 2 : le temps audio perçu). Cette classe ne connaît pas le canvas :
 * elle expose une position « visuelle » en unités de case, que le rendu projette.
 */

/** Ce dont le rendu a besoin pour dessiner le joueur à un instant donné. */
export interface PlayerView {
  /** Position visuelle (unités de case, fractionnaire pendant le tween). */
  x: number;
  y: number;
  /** Direction et progression (0→1) du déplacement en cours, null si immobile. */
  moveDir: Dir | null;
  moveProgress: number;
  /** Bump contre le bord : direction et amplitude courante (unités de case). */
  bumpDir: Dir | null;
  bumpAmount: number;
  /** Progression brute du bump (0→1), pour les effets de bord. */
  bumpProgress: number;
}

interface Bump {
  dir: Dir;
  start: number;
}

/** Courbe d'easing du tween : départ très vif, arrivée douce. */
function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export class Player {
  private from: Cell;
  private to: Cell;
  private moveDir: Dir | null = null;
  private moveStart = -Infinity;
  private readonly queue: Dir[] = [];
  private bump: Bump | null = null;
  /** Derniers déplacements (pour connaître la case occupée à un instant passé précis). */
  private history: { start: number; from: Cell; to: Cell }[] = [];
  private origin: Cell;

  private readonly tween = MOVE_TWEEN_MS / 1000;
  private readonly bumpDuration = BUMP_MS / 1000;

  constructor(start: Cell = CENTER) {
    this.from = { ...start };
    this.to = { ...start };
    this.origin = { ...start };
  }

  /** Replace le joueur sur une case, sans animation, et vide le buffer. */
  reset(cell: Cell = CENTER): void {
    this.from = { ...cell };
    this.to = { ...cell };
    this.origin = { ...cell };
    this.moveDir = null;
    this.moveStart = -Infinity;
    this.queue.length = 0;
    this.bump = null;
    this.history = [];
  }

  private get moveEnd(): number {
    return this.moveStart + this.tween;
  }

  isMoving(now: number): boolean {
    return now < this.moveEnd;
  }

  /**
   * Demande de déplacement (appelée au moment exact de l'appui).
   * Si un tween est en cours, l'appui est mémorisé et exécuté dès sa fin.
   */
  requestMove(dir: Dir, now: number): void {
    this.update(now);
    if (this.isMoving(now)) {
      if (this.queue.length < INPUT_BUFFER_SIZE) this.queue.push(dir);
      return;
    }
    this.execute(dir, now);
  }

  /**
   * Fait avancer le buffer. Les déplacements mémorisés démarrent pile à la fin
   * du tween précédent (et non à la frame suivante) : l'enchaînement ne dépend
   * pas du framerate.
   */
  update(now: number): void {
    while (this.queue.length > 0 && now >= this.moveEnd) {
      this.execute(this.queue.shift()!, this.moveEnd);
    }
  }

  private execute(dir: Dir, t: number): void {
    const target = neighbor(this.to, dir);
    if (!inBounds(target)) {
      // Contre le bord : on ne bouge pas, petit rebond visuel. Ne bloque pas les inputs suivants.
      this.bump = { dir, start: t };
      return;
    }
    this.from = this.to;
    this.to = target;
    this.moveDir = dir;
    this.moveStart = t;
    this.history.push({ start: t, from: this.from, to: target });
    if (this.history.length > 16) this.history.shift();
  }

  /**
   * Case occupée (au sens des collisions) à un instant `t`, éventuellement passé :
   * permet de tester la position exacte au début d'un impact, indépendamment du framerate.
   */
  cellAt(t: number): Cell {
    for (let i = this.history.length - 1; i >= 0; i--) {
      const h = this.history[i];
      if (h.start <= t) return (t - h.start) / this.tween >= HITBOX_SWITCH_RATIO - 1e-9 ? h.to : h.from;
    }
    return this.history.length > 0 ? this.history[0].from : this.origin;
  }

  /** Progression du tween courant (0→1, 1 si immobile). */
  progress(now: number): number {
    if (!Number.isFinite(this.moveStart)) return 1;
    return Math.min(1, Math.max(0, (now - this.moveStart) / this.tween));
  }

  /**
   * Case sur laquelle le joueur est « logiquement » pour les collisions.
   * Hitbox indulgente : on ne bascule sur la case d'arrivée qu'à mi-tween.
   */
  logicalCell(now: number): Cell {
    return this.progress(now) >= HITBOX_SWITCH_RATIO - 1e-9 ? this.to : this.from;
  }

  /** Case de destination (où le joueur sera une fois le tween fini). */
  targetCell(): Cell {
    return this.to;
  }

  view(now: number): PlayerView {
    const p = this.progress(now);
    const e = easeOutCubic(p);
    const moving = p < 1;

    let bumpDir: Dir | null = null;
    let bumpAmount = 0;
    let bumpProgress = 1;
    if (this.bump) {
      const bt = (now - this.bump.start) / this.bumpDuration;
      if (bt >= 0 && bt < 1) {
        bumpDir = this.bump.dir;
        bumpProgress = bt;
        // Aller-retour rapide : pic au premier tiers puis retour amorti.
        bumpAmount = Math.sin(Math.PI * Math.pow(bt, 0.6)) * BUMP_DISTANCE;
      } else if (bt >= 1) {
        this.bump = null;
      }
    }

    const v = bumpDir ? DIR_VECTORS[bumpDir] : { x: 0, y: 0 };
    return {
      x: this.from.x + (this.to.x - this.from.x) * e + v.x * bumpAmount,
      y: this.from.y + (this.to.y - this.from.y) * e + v.y * bumpAmount,
      moveDir: moving ? this.moveDir : null,
      moveProgress: p,
      bumpDir,
      bumpAmount,
      bumpProgress,
    };
  }
}
