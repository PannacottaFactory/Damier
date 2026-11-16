import { createRng } from '../core/random';

/**
 * Éclatement du joueur à la mort : des fragments (triangles et petits carrés) projetés
 * depuis sa case. Tout est fonction du temps écoulé depuis la mort et d'une graine :
 * aucun état à maintenir, et l'animation se fige correctement en pause.
 */
interface Fragment {
  angle: number;
  distance: number;
  spin: number;
  size: number;
  triangle: boolean;
}

const COUNT = 16;
const DURATION = 0.9;

function fragments(seed: number): Fragment[] {
  const rng = createRng(seed);
  return Array.from({ length: COUNT }, (_, i) => ({
    angle: (i / COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.6,
    distance: 0.6 + rng() * 1.4,
    spin: (rng() - 0.5) * 12,
    size: 0.06 + rng() * 0.08,
    triangle: rng() < 0.6,
  }));
}

let cache: { seed: number; list: Fragment[] } | null = null;

export function drawShatter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cell: number,
  elapsed: number,
  seed: number,
  colors: { fill: string; glow: string },
): void {
  if (elapsed >= DURATION) return;
  if (!cache || cache.seed !== seed) cache = { seed, list: fragments(seed) };
  const t = Math.max(0, elapsed) / DURATION;
  const travel = 1 - (1 - t) * (1 - t) * (1 - t); // ease-out : explosion vive puis ralentie
  ctx.save();
  ctx.globalAlpha = 1 - t * t;
  ctx.fillStyle = colors.fill;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = cell * 0.2;
  for (const f of cache.list) {
    const d = f.distance * cell * travel;
    const s = f.size * cell * (1 - 0.5 * t);
    ctx.save();
    ctx.translate(cx + Math.cos(f.angle) * d, cy + Math.sin(f.angle) * d);
    ctx.rotate(f.spin * travel);
    ctx.beginPath();
    if (f.triangle) {
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.87, s * 0.5);
      ctx.lineTo(-s * 0.87, s * 0.5);
      ctx.closePath();
    } else {
      ctx.rect(-s / 2, -s / 2, s, s);
    }
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
