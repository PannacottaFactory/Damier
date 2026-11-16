import { SWIPE_MIN_PX } from '../config';
import type { Dir } from '../game/grid';

/**
 * Entrées utilisateur → actions abstraites. Le reste du jeu ne voit jamais
 * de KeyboardEvent ni de PointerEvent, ce qui permet d'ajouter le tactile
 * (ou une manette) sans toucher à la logique.
 */
export type Action =
  | { type: 'move'; dir: Dir }
  /** Touches non liées au déplacement (Espace, F1, I…), traitées par les états/le debug. */
  | { type: 'key'; code: string };

/**
 * On s'appuie sur `KeyboardEvent.code` (position physique de la touche) :
 * la touche « KeyW » est Z sur un clavier AZERTY et W sur un QWERTY,
 * donc ZQSD et WASD fonctionnent sans configuration.
 */
const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

/** Touches dont on bloque le comportement par défaut du navigateur (scroll, aide…). */
const PREVENT_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'F1', 'F2', 'PageUp', 'PageDown']);

export class Input {
  private readonly ac = new AbortController();
  private swipeOrigin: { x: number; y: number; id: number } | null = null;

  constructor(
    keyTarget: Window,
    pointerTarget: HTMLElement,
    private readonly onAction: (a: Action) => void,
  ) {
    const opts = { signal: this.ac.signal };
    keyTarget.addEventListener('keydown', (e) => this.onKeyDown(e), opts);
    pointerTarget.addEventListener('pointerdown', (e) => this.onPointerDown(e), opts);
    pointerTarget.addEventListener('pointermove', (e) => this.onPointerMove(e), opts);
    pointerTarget.addEventListener('pointerup', () => (this.swipeOrigin = null), opts);
    pointerTarget.addEventListener('pointercancel', () => (this.swipeOrigin = null), opts);
  }

  dispose(): void {
    this.ac.abort();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    // Une case par appui : la répétition automatique du clavier est ignorée.
    if (e.repeat) return;
    const dir = KEY_TO_DIR[e.code];
    if (dir) this.onAction({ type: 'move', dir });
    else this.onAction({ type: 'key', code: e.code });
  }

  // ─── Swipe (version minimale, affinée à l'étape 10) ─────────────────────

  private onPointerDown(e: PointerEvent): void {
    this.swipeOrigin = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  /** Le swipe est déclenché dès que le seuil est franchi (pas au relâchement) : plus réactif. */
  private onPointerMove(e: PointerEvent): void {
    const o = this.swipeOrigin;
    if (!o || o.id !== e.pointerId) return;
    const dx = e.clientX - o.x;
    const dy = e.clientY - o.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.swipeOrigin = null; // un seul déplacement par geste
    this.onAction({ type: 'move', dir });
  }
}
