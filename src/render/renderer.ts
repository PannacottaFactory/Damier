import { BOARD_SCREEN_RATIO, BUMP_DISTANCE, GRID_SIZE, MAX_DPR, PULSE_SCALE } from '../config';
import { DIR_VECTORS } from '../game/grid';
import type { CellDanger } from '../game/hazards';
import type { PlayerView } from '../game/player';
import type { Cell } from '../game/grid';
import { drawShatter } from './fragments';
import { FONT_FAMILY, type Palette, PALETTE_LEVEL1 } from './palette';
import { type BoardLayout, type DeathView, drawDeath, drawHud, type HudView } from './ui';

/** Tout ce que le rendu doit savoir pour dessiner une frame. */
export interface FrameView {
  player: PlayerView;
  /** Pulsation du kick, 1 au moment du coup puis décroissance vers 0. */
  pulse: number;
  /** L'audio a-t-il démarré ? (sinon : écran « appuie sur une touche »). */
  audioStarted: boolean;
  paused: boolean;
  /** État de danger de chaque case (tableau à plat). */
  cells: readonly CellDanger[];
  /** Chrono, score, rang (null tant qu'aucune partie n'a commencé). */
  hud: HudView | null;
  /** Mort : éclatement du joueur, flash, résultats. */
  death: (DeathView & { cell: Cell; seed: number }) | null;
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
    this.drawHazards(view.cells, ox, oy, cell);
    this.drawBumpFlash(view.player, ox, oy, board);
    if (view.death) {
      const d = view.death;
      drawShatter(ctx, ox + (d.cell.x + 0.5) * cell, oy + (d.cell.y + 0.5) * cell, cell, d.elapsed, d.seed, {
        fill: palette.player,
        glow: palette.danger,
      });
    } else {
      this.drawPlayer(view.player, ox, oy, cell, view.invincible);
    }
    ctx.restore();

    const layout: BoardLayout = { ox, oy, cell, board, width: this.width, height: this.height };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (!view.audioStarted) {
      const big = Math.round(Math.min(this.width, this.height) * 0.035);
      ctx.fillStyle = palette.text;
      ctx.font = `700 ${big}px ${FONT_FAMILY}`;
      ctx.fillText('APPUIE SUR UNE TOUCHE', this.width / 2, oy - cell * 0.6);
    }
    if (view.hud && !view.death) drawHud(ctx, view.hud, layout, palette);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = palette.textDim;
    ctx.font = `400 13px ${FONT_FAMILY}`;
    ctx.fillText('FLÈCHES · ZQSD · WASD · SWIPE   —   ÉCHAP / P : PAUSE   —   F1 : DEBUG', this.width / 2, this.height - 24);
    if (view.death) drawDeath(ctx, view.death, layout, palette);

    if (view.paused) this.drawPause();
  }

  /**
   * Dangers :
   * - AVERTISSEMENT : contour rouge fixe, et un carré qui grandit depuis le centre de la case ;
   *   l'impact tombe quand il la recouvre entièrement. Seul le prochain impact est affiché
   *   en plein ; les suivants n'ont qu'un fin contour discret ;
   * - FANTÔME (call & response) : simple flash de contour blanc, inoffensif ;
   * - IMPACT : case pleine, rouge vif, gros halo ;
   * - DISSIPATION : fondu.
   */
  private drawHazards(cells: readonly CellDanger[], ox: number, oy: number, cell: number): void {
    const { ctx, palette } = this;
    const gap = cell * 0.09;
    const radius = cell * 0.06;

    ctx.save();
    ctx.shadowColor = palette.danger;
    for (let i = 0; i < cells.length; i++) {
      const s = cells[i];
      if (s.warn === 0 && s.impact === 0 && s.later === 0 && s.ghost === 0) continue;
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
      if (s.later > 0 && s.warn === 0) {
        // Avertissement d'un impact ultérieur : pointillés francs + léger voile, sans le carré
        // qui se remplit (réservé au prochain impact). Ils se renforcent à l'approche.
        const inset = gap / 2 + cell * 0.04;
        const size = cell - inset * 2;
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.08 + 0.1 * s.later;
        ctx.fillStyle = palette.danger;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, size, size, radius);
        ctx.fill();
        ctx.globalAlpha = 0.55 + 0.35 * s.later;
        ctx.strokeStyle = palette.danger;
        ctx.lineWidth = Math.max(2, cell * 0.035);
        ctx.setLineDash([size * 0.12, size * 0.08]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (s.ghost > 0) {
        // Fantôme : le « call » montre où ça tombera, sans danger.
        const inset = gap / 2;
        ctx.globalAlpha = s.ghost * 0.9;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.5, cell * 0.04);
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = cell * 0.3 * s.ghost;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2, radius);
        ctx.stroke();
        ctx.shadowColor = palette.danger;
      }
      if (s.warn > 0) {
        // Télégraphie « qui se remplit » : contour fixe = la zone, carré intérieur qui grandit
        // depuis le centre ; quand il touche le contour, ça frappe. Aucun clignotement.
        const inset = gap / 2 + cell * 0.02;
        const size = cell - inset * 2;
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = palette.danger;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, size, size, radius);
        ctx.fill();

        const inner = size * s.warn;
        const off = (size - inner) / 2;
        ctx.globalAlpha = 0.35 + 0.35 * s.warn;
        ctx.beginPath();
        ctx.roundRect(x + inset + off, y + inset + off, inner, inner, radius * s.warn);
        ctx.fill();

        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = palette.danger;
        ctx.lineWidth = Math.max(1.5, cell * 0.03);
        ctx.shadowBlur = cell * 0.15;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, size, size, radius);
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

  private drawPlayer(p: PlayerView, ox: number, oy: number, cell: number, invincible: boolean): void {
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
    ctx.shadowColor = palette.playerGlow;
    ctx.shadowBlur = cell * 0.35;
    ctx.fillStyle = palette.player;
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.12);
    ctx.fill();
    if (invincible) {
      ctx.strokeStyle = palette.playerGlow;
      ctx.lineWidth = Math.max(2, cell * 0.04);
      ctx.setLineDash([size * 0.15, size * 0.1]);
      ctx.stroke();
    }
    ctx.restore();
  }
}
