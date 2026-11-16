import { NEAR_MISS_POINTS, RANK_INTERVAL_S, RANKS, SCORE_PER_SECOND } from '../config';

/**
 * Score et rangs (fonctions pures).
 * Score = temps de survie + near misses (+ bonus ramassés, étape 7).
 */
export type RankName = (typeof RANKS)[number];

/** Index du rang atteint après `seconds` de survie (plafonné au dernier). */
export function rankIndex(seconds: number): number {
  return Math.min(RANKS.length - 1, Math.max(0, Math.floor(seconds / RANK_INTERVAL_S)));
}

export function rankName(seconds: number): RankName {
  return RANKS[rankIndex(seconds)];
}

/** Secondes écoulées depuis le passage au rang courant (Infinity pour le rang de départ). */
export function timeSinceRankUp(seconds: number): number {
  const i = rankIndex(seconds);
  return i === 0 ? Infinity : seconds - i * RANK_INTERVAL_S;
}

export function computeScore(seconds: number, nearMisses: number, bonusPoints = 0): number {
  return Math.floor(seconds * SCORE_PER_SECOND) + nearMisses * NEAR_MISS_POINTS + bonusPoints;
}

/** Chrono : secondes + centièmes (« 12.34 »). */
export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const whole = Math.floor(s);
  const cents = Math.min(99, Math.floor((s - whole) * 100 + 1e-6));
  return `${whole}.${String(cents).padStart(2, '0')}`;
}
