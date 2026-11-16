import { BOARD_SCREEN_RATIO, BUMP_DISTANCE, GRID_SIZE, MAX_DPR, PULSE_SCALE } from '../config';
import { DIR_VECTORS } from '../game/grid';
import type { CellDanger } from '../game/hazards';
import type { PlayerView } from '../game/player';
import { FONT_FAMILY, type Palette, PALETTE_LEVEL1 } from './palette';

/** Tout ce que le rendu doit savoir pour dessiner une frame. */
export interface FrameView {
  player: PlayerView;
  /** Pulsation du kick, 1 au moment du coup puis décroissance vers 0. */
  pulse: number;
  /** L'audio a-t-il démarré ? (sinon : écran « appuie sur une touche »). */
  audioStarted: boolean;
  paused: boolean;
  /** Beat courant (sert au clignotement des avertissements, calé sur la musique). */
  beat: number;
  /** État de danger de chaque case (tableau à plat). */
  cells: readonly CellDanger[];
  /** Mort : le joueur est affiché touché, avec l'invitation à rejouer. */
  dead: boolean;
  invincible: boolean;
}

/**
 * Rendu Canvas 2D plein écran, net sur les écrans haute densité.
 * On dessine en pixels CSS ; la mise à l'échelle devicePixelRatio est
 * appliquée une fois via setTransform.
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private palette: Palette = PALETTE_LEVEL1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D non disponible');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  render(view: FrameView): void {
    const { ctx, palette } = this;
    // Le devicePixelRatio peut changer (déplacement vers un autre écran, zoom).
    if (Math.min(window.devicePixelRatio || 1, MAX_DPR) !== this.dpr) this.resize();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.drawBackground();

    // Géométrie du damier, centrée.
    const board = Math.min(this.width, this.height) * BOARD_SCREEN_RATIO;
    const cell = board / GRID_SIZE;
    const ox = (this.width - board) / 2;
    const oy = (this.height - board) / 2;

    // Le damier « respire » sur le kick : zoom autour du centre de l'écran.
    const scale = 1 + PULSE_SCALE * view.pulse;
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-this.width / 2, -this.height / 2);
    this.drawGrid(ox, oy, cell, view.pulse);
    this.drawHazards(view.cells, view.beat, ox, oy, cell);
    this.drawBumpFlash(view.player, ox, oy, board);
    this.drawPlayer(view.player, ox, oy, cell, view.dead, view.invincible);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const big = Math.round(Math.min(this.width, this.height) * 0.035);
    if (!view.audioStarted) {
      ctx.fillStyle = palette.text;
      ctx.font = `700 ${big}px ${FONT_FAMILY}`;
      ctx.fillText('APPUIE SUR UNE TOUCHE', this.width / 2, oy - cell * 0.6);
    } else if (view.dead) {
      ctx.fillStyle = palette.danger;
      ctx.font = `800 ${big}px ${FONT_FAMILY}`;
      ctx.fillText('TOUCHÉ', this.width / 2, oy - cell * 0.6);
      ctx.fillStyle = palette.text;
      ctx.font = `400 ${Math.round(big * 0.55)}px ${FONT_FAMILY}`;
      ctx.fillText('ESPACE POUR REJOUER', this.width / 2, oy + board + cell * 0.75);
    }
    ctx.fillStyle = palette.textDim;
    ctx.font = `400 13px ${FONT_FAMILY}`;
    ctx.fillText('FLÈCHES · ZQSD · WASD · SWIPE   —   ÉCHAP / P : PAUSE   —   F1 : DEBUG', this.width / 2, this.height - 24);

    if (view.paused) this.drawPause();
  }

  /**
   * Dangers :
   * - AVERTISSEMENT : contour rouge qui clignote sur les croches (calé sur le beat),
   *   plus un remplissage qui monte au fil du compte à rebours ;
   * - IMPACT : case pleine, rouge vif, gros halo ;
   * - DISSIPATION : fondu.
   */
  private drawHazards(cells: readonly CellDanger[], beat: number, ox: number, oy: number, cell: number): void {
    const { ctx, palette } = this;
    const gap = cell * 0.09;
    const radius = cell * 0.06;
    // Clignotement : pic sur chaque croche.
    const blink = 0.5 + 0.5 * Math.cos(2 * Math.PI * beat * 2);

    ctx.save();
    ctx.shadowColor = palette.danger;
    for (let i = 0; i < cells.length; i++) {
      const s = cells[i];
      if (s.warn === 0 && s.impact === 0) continue;
      const x = ox + (i % GRID_SIZE) * cell;
      const y = oy + Math.floor(i / GRID_SIZE) * cell;

      if (s.impact > 0) {
        // Explosion : la case déborde un peu et brille fort.
        const grow = cell * 0.04 * s.impact;
        ctx.globalAlpha = Math.min(1, s.impact * 1.1);
        ctx.fillStyle = palette.danger;
        ctx.shadowBlur = cell * 0.6 * s.impact;
        ctx.beginPath();
        ctx.roundRect(x + gap / 2 - grow, y + gap / 2 - grow, cell - gap + grow * 2, cell - gap + grow * 2, radius);
        ctx.fill();
        // Cœur blanc au tout début de l'impact : c'est le « flash ».
        if (s.impact > 0.85) {
          ctx.globalAlpha = (s.impact - 0.85) / 0.15;
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 0;
          const inset = cell * 0.22;
          ctx.fillRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2);
        }
      }
      if (s.warn > 0) {
        const inset = gap / 2 + cell * 0.02;
        const size = cell - inset * 2;
        // Remplissage qui monte avec le compte à rebours.
        ctx.globalAlpha = 0.06 + 0.22 * s.warn;
        ctx.fillStyle = palette.danger;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, size, size, radius);
        ctx.fill();
        // Contour pulsé, de plus en plus épais à l'approche de l'impact.
        ctx.globalAlpha = 0.45 + 0.55 * blink;
        ctx.strokeStyle = palette.danger;
        ctx.lineWidth = Math.max(1.5, cell * (0.025 + 0.035 * s.warn));
        ctx.shadowBlur = cell * 0.25 * blink;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawPause(): void {
    const { ctx, palette, width: w, height: h } = this;
    ctx.fillStyle = 'rgba(3, 4, 10, 0.72)';
    ctx.fillRect(0, 0, w, h);
    const size = Math.round(Math.min(w, h) * 0.08);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.fillStyle = palette.text;
    ctx.shadowColor = palette.grid;
    ctx.shadowBlur = size * 0.4;
    ctx.font = `800 ${size}px ${FONT_FAMILY}`;
    ctx.fillText('PAUSE', w / 2, h / 2);
    ctx.restore();
    ctx.fillStyle = palette.textDim;
    ctx.font = `400 ${Math.round(size * 0.22)}px ${FONT_FAMILY}`;
    ctx.fillText('ÉCHAP · P · CLIC SUR ▶ POUR REPRENDRE', w / 2, h / 2 + size * 0.9);
  }

  private drawBackground(): void {
    const { ctx, palette, width: w, height: h } = this;
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
    g.addColorStop(0, palette.bgGlow);
    g.addColorStop(1, palette.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /** Toutes les cases dans un seul chemin → un seul passage de flou (shadowBlur coûte cher). */
  private drawGrid(ox: number, oy: number, cell: number, pulse: number): void {
    const { ctx, palette } = this;
    const gap = cell * 0.09;
    const size = cell - gap;
    const radius = cell * 0.06;

    ctx.beginPath();
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        ctx.roundRect(ox + x * cell + gap / 2, oy + y * cell + gap / 2, size, size, radius);
      }
    }
    ctx.fillStyle = palette.gridFill;
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = palette.grid;
    // Le kick fait aussi briller les bords.
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.lineWidth = Math.max(1, cell * (0.018 + 0.01 * pulse));
    ctx.shadowColor = palette.grid;
    ctx.shadowBlur = cell * (0.1 + 0.15 * pulse);
    ctx.stroke();
    ctx.restore();
  }

  /** Le bord du damier s'illumine brièvement quand on tape dedans. */
  private drawBumpFlash(p: PlayerView, ox: number, oy: number, board: number): void {
    if (!p.bumpDir) return;
    const { ctx, palette } = this;
    const v = DIR_VECTORS[p.bumpDir];
    const alpha = 1 - p.bumpProgress;
    const cell = board / GRID_SIZE;
    // Segment de bord, limité à la ligne/colonne du joueur.
    const cx = ox + (Math.round(p.x) + 0.5) * cell;
    const cy = oy + (Math.round(p.y) + 0.5) * cell;
    const half = cell * 0.55;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = palette.player;
    ctx.shadowColor = palette.playerGlow;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (v.x !== 0) {
      const x = v.x > 0 ? ox + board + 4 : ox - 4;
      ctx.moveTo(x, cy - half);
      ctx.lineTo(x, cy + half);
    } else {
      const y = v.y > 0 ? oy + board + 4 : oy - 4;
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawPlayer(p: PlayerView, ox: number, oy: number, cell: number, dead: boolean, invincible: boolean): void {
    const { ctx, palette } = this;
    const cx = ox + (p.x + 0.5) * cell;
    const cy = oy + (p.y + 0.5) * cell;
    const size = cell * 0.42;

    // Squash & stretch : étiré dans le sens du mouvement, écrasé contre le bord.
    let sx = 1;
    let sy = 1;
    if (p.moveDir) {
      const stretch = 0.28 * Math.sin(Math.PI * p.moveProgress);
      const horizontal = DIR_VECTORS[p.moveDir].x !== 0;
      sx = horizontal ? 1 + stretch : 1 - stretch * 0.5;
      sy = horizontal ? 1 - stretch * 0.5 : 1 + stretch;
    } else if (p.bumpDir) {
      const squash = (p.bumpAmount / BUMP_DISTANCE) * 0.22;
      const horizontal = DIR_VECTORS[p.bumpDir].x !== 0;
      sx = horizontal ? 1 - squash : 1 + squash * 0.6;
      sy = horizontal ? 1 + squash * 0.6 : 1 - squash;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    // Mort : carré noir cerclé de rouge (l'éclatement en fragments arrive à l'étape 6).
    ctx.shadowColor = dead ? palette.danger : palette.playerGlow;
    ctx.shadowBlur = cell * 0.35;
    ctx.fillStyle = dead ? palette.bg : palette.player;
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.12);
    ctx.fill();
    if (dead || invincible) {
      ctx.strokeStyle = dead ? palette.danger : palette.playerGlow;
      ctx.lineWidth = Math.max(2, cell * 0.04);
      ctx.setLineDash(invincible && !dead ? [size * 0.15, size * 0.1] : []);
      ctx.stroke();
    }
    ctx.restore();
  }
}
