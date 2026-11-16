import { BEATS_PER_BAR, COMMIT_AHEAD_BEATS, FIRST_PATTERN_DELAY_BARS, GRID_SIZE, IMPACT_BEATS, WARN_BEATS } from '../config';
import { type Rng, shuffled } from '../core/random';
import type { Cell } from '../game/grid';
import type { Hazard, HazardField } from '../game/hazards';
import { DEFAULT_SURVIVABILITY, type Impact, isSurvivable, type SurvivabilityOptions } from './survivability';
import type { Pattern } from './types';

/** Conversion temps ↔ beats (implémentée par TempoMap). */
export interface BeatTime {
  beatAt(t: number): number;
  timeAt(beat: number): number;
}

export interface DirectorContext {
  beat: number;
  now: number;
  tempo: BeatTime;
  /** Case où se trouve (ou arrive) le joueur. */
  playerCell: Cell;
  hazards: HazardField;
  /** Intensité de la section en cours (0..1). */
  intensity: number;
}

/** Danger prêt à être ajouté (sans id). */
export type HazardSpec = Omit<Hazard, 'id'>;

/** Instancie un pattern dont le temps 0 tombe sur `startBeat`. */
export function instantiate(pattern: Pattern, startBeat: number, warnBeats: number): HazardSpec[] {
  return pattern.steps.map((s) => ({
    patternId: pattern.id,
    cells: s.cells.map(([x, y]) => y * GRID_SIZE + x),
    warnBeat: startBeat + s.beatOffset - warnBeats,
    impactBeat: startBeat + s.beatOffset,
    impactLen: IMPACT_BEATS,
  }));
}

/** Convertit des dangers (en beats) en impacts (en secondes relatives à `now`) pour le BFS. */
export function toImpacts(hazards: readonly HazardSpec[], tempo: BeatTime, now: number): Impact[] {
  return hazards.map((h) => {
    const t = tempo.timeAt(h.impactBeat);
    return {
      warnTime: tempo.timeAt(h.warnBeat) - now,
      time: t - now,
      duration: tempo.timeAt(h.impactBeat + h.impactLen) - t,
      cells: h.cells,
    };
  });
}

/**
 * Director (version étape 4) : un pattern par mesure (ou toutes les 2 mesures quand
 * l'intensité est basse), choisi au hasard en évitant la même famille deux fois de suite.
 * Chaque candidat est validé par isSurvivable AVEC les dangers déjà en vol, depuis
 * la position réelle du joueur, au moment où son avertissement apparaît.
 */
export class PatternDirector {
  private nextSlot = Infinity;
  private lastFamily: string | null = null;

  constructor(
    private readonly library: readonly Pattern[],
    private readonly rng: Rng,
    private readonly warnBeats = WARN_BEATS,
    private readonly fairness: SurvivabilityOptions = DEFAULT_SURVIVABILITY,
  ) {}

  /** (Re)démarrage : répit de quelques mesures, premier pattern sur un début de mesure. */
  reset(beat: number): void {
    this.nextSlot = Math.ceil(beat / BEATS_PER_BAR) * BEATS_PER_BAR + FIRST_PATTERN_DELAY_BARS * BEATS_PER_BAR;
    this.lastFamily = null;
  }

  /** Arrêt (mort) : plus aucun pattern. */
  stop(): void {
    this.nextSlot = Infinity;
  }

  /** À appeler chaque frame. Renvoie le pattern engagé, s'il y en a un. */
  update(ctx: DirectorContext): Pattern | null {
    if (ctx.beat < this.nextSlot - this.warnBeats - COMMIT_AHEAD_BEATS) return null;
    const slot = this.nextSlot;
    this.nextSlot += (ctx.intensity >= 0.6 ? 1 : 2) * BEATS_PER_BAR;
    // Créneau raté (ne devrait pas arriver) : on ne lance pas un avertissement déjà entamé.
    if (slot - this.warnBeats < ctx.beat - COMMIT_AHEAD_BEATS) return null;
    return this.place(slot, ctx);
  }

  private place(slot: number, ctx: DirectorContext): Pattern | null {
    const existing: HazardSpec[] = ctx.hazards.upcoming(ctx.beat).filter((h) => h.impactBeat > ctx.beat);
    // Familles mélangées, la dernière jouée relayée en fin de liste.
    const families = shuffled(this.rng, [...new Set(this.library.map((p) => p.family))]);
    families.sort((a, b) => Number(a === this.lastFamily) - Number(b === this.lastFamily));

    for (const family of families) {
      const variants = shuffled(
        this.rng,
        this.library.filter((p) => p.family === family),
      );
      for (const pattern of variants) {
        const specs = instantiate(pattern, slot, this.warnBeats);
        const impacts = toImpacts([...existing, ...specs], ctx.tempo, ctx.now);
        if (!isSurvivable(impacts, ctx.playerCell, this.fairness)) continue;
        for (const s of specs) ctx.hazards.add(s);
        this.lastFamily = family;
        return pattern;
      }
    }
    return null;
  }
}
