import { DEATH_FLASH_MS, NEAR_MISS_POINTS, RANKS, RESTART_LOCK_MS } from '../config';
import type { Cell } from '../game/grid';
import { formatTime } from '../game/score';
import { FONT_FAMILY, type Palette } from './palette';

/**
 * Interface en jeu (HUD) et écran de mort. Dessin pur à partir de données :
 * le state de jeu ne connaît pas le canvas.
 */
export interface HudView {
  /** Temps de survie (s). */
  time: number;
  score: number;
  rank: number;
  /** Secondes depuis le dernier passage de rang (Infinity si aucun). */
  sinceRankUp: number;
  bestTime: number;
  /** Near misses récents : âge (s) et case frôlée. */
  nearMisses: readonly { age: number; cell: Cell }[];
}

export interface DeathView {
  /** Secondes écoulées depuis la mort. */
  elapsed: number;
  survived: number;
  score: number;
  rank: number;
  bestTime: number;
  bestScore: number;
  newBestTime: boolean;
  newBestScore: boolean;
}

/** Géométrie du damier à l'écran. */
export interface BoardLayout {
  ox: number;
  oy: number;
  cell: number;
  board: number;
  width: number;
  height: number;
}

/**
 * Icône du rang : un vumètre de 5 barres de hauteur croissante, allumées jusqu'au rang atteint.
 * (x, y) = coin bas-gauche, `h` = hauteur de la plus grande barre.
 */
export function drawRankMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  rank: number,
  on: string,
  off: string,
): void {
  const bars = RANKS.length;
  const bw = h * 0.22;
  const gap = h * 0.12;
  for (let i = 0; i < bars; i++) {
    const bh = h * (0.35 + (0.65 * i) / (bars - 1));
    ctx.fillStyle = i <= rank ? on : off;
    ctx.fillRect(x + i * (bw + gap), y - bh, bw, bh);
  }
}

/** Largeur totale du vumètre pour une hauteur donnée. */
export function rankMeterWidth(h: number): number {
  return RANKS.length * h * 0.22 + (RANKS.length - 1) * h * 0.12;
}

export function drawHud(ctx: CanvasRenderingContext2D, hud: HudView, layout: BoardLayout, palette: Palette): void {
  const { width: w, ox, oy, cell } = layout;
  const unit = Math.min(layout.width, layout.height);
  const margin = Math.max(16, unit * 0.035);

  ctx.save();
  ctx.textBaseline = 'top';

  // ─── Chrono (en gros, en haut à droite) + score + record ───
  const big = Math.round(unit * 0.075);
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.text;
  ctx.shadowColor = palette.grid;
  ctx.shadowBlur = big * 0.25;
  ctx.font = `800 ${big}px ${FONT_FAMILY}`;
  ctx.fillText(formatTime(hud.time), w - margin, margin);
  ctx.shadowBlur = 0;
  const small = Math.round(big * 0.28);
  ctx.font = `700 ${small}px ${FONT_FAMILY}`;
  ctx.fillText(`SCORE ${hud.score}`, w - margin, margin + big * 1.05);
  if (hud.bestTime > 0) {
    ctx.fillStyle = palette.textDim;
    ctx.font = `400 ${small}px ${FONT_FAMILY}`;
    ctx.fillText(`RECORD ${formatTime(hud.bestTime)}`, w - margin, margin + big * 1.05 + small * 1.4);
  }

  // ─── Rang (en haut à gauche) : vumètre + nom ───
  const mh = big * 0.62;
  ctx.textAlign = 'left';
  ctx.shadowColor = palette.grid;
  ctx.shadowBlur = mh * 0.3;
  drawRankMeter(ctx, margin, margin + big * 0.5 + mh / 2, mh, hud.rank, palette.grid, 'rgba(255, 255, 255, 0.12)');
  ctx.shadowBlur = 0;
  ctx.fillStyle = palette.text;
  ctx.font = `800 ${Math.round(big * 0.38)}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(RANKS[hud.rank], margin + rankMeterWidth(mh) + big * 0.25, margin + big * 0.5);

  // ─── Annonce du nouveau rang, au-dessus du damier ───
  if (hud.sinceRankUp < 1.4) {
    const t = hud.sinceRankUp / 1.4;
    const pop = 1 + 0.35 * Math.max(0, 1 - t * 5);
    ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.text;
    ctx.shadowColor = palette.grid;
    ctx.shadowBlur = big * 0.4;
    ctx.font = `800 ${Math.round(big * 0.55 * pop)}px ${FONT_FAMILY}`;
    ctx.fillText(RANKS[hud.rank], w / 2, oy - cell * 0.55);
    ctx.globalAlpha = 1;
  }

  // ─── Near miss : « +250 » qui monte au-dessus de la case frôlée ───
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(cell * 0.22)}px ${FONT_FAMILY}`;
  ctx.shadowColor = palette.playerGlow;
  ctx.shadowBlur = cell * 0.15;
  for (const nm of hud.nearMisses) {
    if (nm.age < 0 || nm.age > 0.7) continue;
    const t = nm.age / 0.7;
    ctx.globalAlpha = 1 - t * t;
    ctx.fillStyle = palette.playerGlow;
    ctx.fillText(`+${NEAR_MISS_POINTS}`, ox + (nm.cell.x + 0.5) * cell, oy + (nm.cell.y + 0.5 - 0.3 - 0.4 * t) * cell);
  }
  ctx.restore();
}

/** Écran de mort : flash blanc, résultats, invitation à relancer. */
export function drawDeath(ctx: CanvasRenderingContext2D, d: DeathView, layout: BoardLayout, palette: Palette): void {
  const { width: w, height: h, oy, board, cell } = layout;
  const unit = Math.min(w, h);

  ctx.save();
  // Voile sombre progressif pour faire ressortir les résultats.
  ctx.fillStyle = `rgba(3, 4, 10, ${Math.min(0.55, d.elapsed * 1.5)})`;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const big = Math.round(unit * 0.11);
  const cy = h / 2;

  // Temps de survie en très gros, au centre.
  ctx.fillStyle = palette.text;
  ctx.shadowColor = d.newBestTime ? palette.playerGlow : palette.danger;
  ctx.shadowBlur = big * 0.35;
  ctx.font = `800 ${big}px ${FONT_FAMILY}`;
  ctx.fillText(formatTime(d.survived), w / 2, cy - big * 0.15);
  ctx.shadowBlur = 0;

  const small = Math.round(big * 0.24);
  ctx.font = `700 ${small}px ${FONT_FAMILY}`;
  ctx.fillStyle = palette.danger;
  ctx.fillText('TOUCHÉ', w / 2, oy - cell * 0.55);

  ctx.fillStyle = palette.text;
  ctx.fillText(`SCORE ${d.score}   ·   ${RANKS[d.rank]}`, w / 2, cy + big * 0.6);

  ctx.font = `400 ${small}px ${FONT_FAMILY}`;
  if (d.newBestTime || d.newBestScore) {
    // Nouveau record : ça pulse doucement.
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(d.elapsed * 8);
    ctx.fillStyle = palette.playerGlow;
    ctx.font = `800 ${small}px ${FONT_FAMILY}`;
    ctx.fillText(d.newBestTime ? 'NOUVEAU RECORD !' : 'NOUVEAU MEILLEUR SCORE !', w / 2, cy + big * 0.95);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = palette.textDim;
    ctx.fillText(`RECORD ${formatTime(d.bestTime)}   ·   MEILLEUR SCORE ${d.bestScore}`, w / 2, cy + big * 0.95);
  }

  // « ESPACE POUR REJOUER » apparaît une fois le verrou de relance levé.
  const ready = d.elapsed - RESTART_LOCK_MS / 1000;
  if (ready > 0) {
    ctx.globalAlpha = Math.min(1, ready * 6);
    ctx.fillStyle = palette.text;
    ctx.font = `700 ${Math.round(small * 0.9)}px ${FONT_FAMILY}`;
    ctx.fillText('ESPACE · TAP POUR REJOUER', w / 2, oy + board + cell * 0.6);
    ctx.globalAlpha = 1;
  }

  // Flash blanc, par-dessus tout.
  const flash = 1 - d.elapsed / (DEATH_FLASH_MS / 1000);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * flash * flash})`;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
