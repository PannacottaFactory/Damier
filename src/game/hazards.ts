import { FADE_BEATS, GRID_SIZE } from '../config';

/**
 * Dangers actifs. Tout est daté en BEATS : si le tempo change (bonus Ralenti),
 * les avertissements et impacts suivent la musique automatiquement.
 *
 * Cycle d'un danger :
 *   [warnBeat, impactBeat)               AVERTISSEMENT  (contour rouge pulsé, inoffensif)
 *   [impactBeat, impactBeat + impactLen) IMPACT         (mortel)
 *   [fin impact, + FADE_BEATS)           DISSIPATION    (fondu, inoffensif)
 */
export interface Hazard {
  id: number;
  patternId: string;
  /** Index des cases (y * GRID_SIZE + x). */
  cells: readonly number[];
  warnBeat: number;
  impactBeat: number;
  impactLen: number;
}

export type HazardPhase = 'pending' | 'warning' | 'impact' | 'fade' | 'done';

export function hazardPhase(h: Hazard, beat: number): HazardPhase {
  if (beat < h.warnBeat) return 'pending';
  if (beat < h.impactBeat) return 'warning';
  if (beat < h.impactBeat + h.impactLen) return 'impact';
  if (beat < h.impactBeat + h.impactLen + FADE_BEATS) return 'fade';
  return 'done';
}

/** État visuel d'une case, agrégé sur tous les dangers qui la concernent. */
export interface CellDanger {
  /** Progression de l'avertissement (0 = aucun, sinon ]0, 1], 1 = impact imminent). */
  warn: number;
  /** Intensité de l'explosion (1 au moment de l'impact, décroît pendant le fondu). */
  impact: number;
}

const BEAT_EPS = 1e-6;

export class HazardField {
  private hazards: Hazard[] = [];
  private nextId = 1;

  add(h: Omit<Hazard, 'id'>): Hazard {
    const hazard = { ...h, id: this.nextId++ };
    this.hazards.push(hazard);
    return hazard;
  }

  clear(): void {
    this.hazards.length = 0;
  }

  /** Annule les dangers dont l'impact n'a pas encore eu lieu. */
  cancelAfter(beat: number): void {
    this.hazards = this.hazards.filter((h) => h.impactBeat <= beat);
  }

  /** Retire les dangers totalement terminés. */
  prune(beat: number): void {
    this.hazards = this.hazards.filter((h) => hazardPhase(h, beat) !== 'done');
  }

  all(): readonly Hazard[] {
    return this.hazards;
  }

  /** La case est-elle mortelle à ce beat ? */
  isLethal(cell: number, beat: number): boolean {
    return this.hazards.some((h) => hazardPhase(h, beat) === 'impact' && h.cells.includes(cell));
  }

  /** Beats de début d'impact dans l'intervalle ]from, to] (pour l'échantillonnage des collisions). */
  impactStartsBetween(from: number, to: number): number[] {
    const out = new Set<number>();
    for (const h of this.hazards) if (h.impactBeat > from && h.impactBeat <= to) out.add(h.impactBeat);
    return [...out].sort((a, b) => a - b);
  }

  /** Nombre de dangers dont l'impact tombe exactement sur ce beat (déclenche le son d'impact). */
  impactsAt(beat: number): number {
    return this.hazards.filter((h) => Math.abs(h.impactBeat - beat) < BEAT_EPS).length;
  }

  /** Dangers dont l'impact n'est pas encore terminé (à prendre en compte pour l'équité). */
  upcoming(beat: number): Hazard[] {
    return this.hazards.filter((h) => h.impactBeat + h.impactLen > beat);
  }

  /** État visuel de chaque case (tableau à plat, GRID_SIZE²). */
  cellStates(beat: number): CellDanger[] {
    const out: CellDanger[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => ({ warn: 0, impact: 0 }));
    for (const h of this.hazards) {
      const phase = hazardPhase(h, beat);
      let warn = 0;
      let impact = 0;
      if (phase === 'warning') {
        warn = Math.max(0.001, (beat - h.warnBeat) / (h.impactBeat - h.warnBeat));
      } else if (phase === 'impact') {
        impact = 1 - 0.25 * ((beat - h.impactBeat) / h.impactLen);
      } else if (phase === 'fade') {
        impact = 0.75 * (1 - (beat - h.impactBeat - h.impactLen) / FADE_BEATS);
      } else continue;
      for (const c of h.cells) {
        const s = out[c];
        s.warn = Math.max(s.warn, warn);
        s.impact = Math.max(s.impact, impact);
      }
    }
    return out;
  }
}
