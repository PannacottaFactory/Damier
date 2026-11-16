import type { SectionSpan } from '../audio/arrangement';
import {
  BARS_PER_PHRASE,
  BEATS_PER_BAR,
  BIG_PATTERN_CHANCE_EASY,
  BIG_PATTERN_CHANCE_HARD,
  BIG_PATTERN_PHRASE_BONUS,
  COMMIT_AHEAD_BEATS,
  FIRST_PATTERN_DELAY_BARS,
  GRID_1_BEAT_DIFFICULTY,
  GRID_2_BEATS_DIFFICULTY,
  GRID_SIZE,
  IMPACT_BEATS,
  LOOP_DIFFICULTY_BONUS,
  REST_BEATS_EASY,
  REST_BEATS_HARD,
  WARN_BEATS,
} from '../config';
import { type Rng, shuffled } from '../core/random';
import type { Cell } from '../game/grid';
import type { Hazard, HazardField } from '../game/hazards';
import { DEFAULT_SURVIVABILITY, type Impact, isSurvivable, type SurvivabilityOptions } from './survivability';
import { type Pattern, type PatternDef, patternLength } from './types';

/** Conversion temps ↔ beats (implémentée par TempoMap). */
export interface BeatTime {
  beatAt(t: number): number;
  timeAt(beat: number): number;
}

/** Section musicale vue par le director (prévision à un beat donné). */
export type SectionInfo = Pick<SectionSpan, 'name' | 'intensity' | 'loop' | 'beat'>;

/** Section par défaut avant que la musique ait annoncé la sienne. */
const FALLBACK_SECTION: SectionInfo = { name: 'INTRO', intensity: 0.2, loop: 0, beat: 0 };

export interface DirectorContext {
  beat: number;
  now: number;
  tempo: BeatTime;
  /** Case où se trouve (ou arrive) le joueur. */
  playerCell: Cell;
  hazards: HazardField;
  /** Section qui jouera à un beat donné (null tant que la musique n'a pas commencé). */
  sectionAt(beat: number): SectionInfo | null;
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
    ...(s.ghost ? { ghost: true } : {}),
  }));
}

/** Convertit des dangers (en beats) en impacts (en secondes relatives à `now`) pour le BFS. Les fantômes sont ignorés. */
export function toImpacts(hazards: readonly HazardSpec[], tempo: BeatTime, now: number): Impact[] {
  return hazards
    .filter((h) => !h.ghost)
    .map((h) => {
      const t = tempo.timeAt(h.impactBeat);
      return {
        warnTime: tempo.timeAt(h.warnBeat) - now,
        time: t - now,
        duration: tempo.timeAt(h.impactBeat + h.impactLen) - t,
        cells: h.cells,
      };
    });
}

/** Difficulté d'une section : son intensité, plus un bonus à chaque rebouclage du morceau. */
export function difficultyOf(sec: SectionInfo): number {
  return sec.intensity + LOOP_DIFFICULTY_BONUS * sec.loop;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/**
 * PatternDirector : choisit les patterns selon la section musicale.
 *
 * - Créneaux : chaque mesure quand c'est calme, chaque demi-mesure puis chaque temps quand ça
 *   chauffe ; après un pattern, un silence d'autant plus court que la section est intense.
 * - Les gros patterns (en plusieurs temps : balayages, déplacements, spirale…) ne démarrent que
 *   sur un début de mesure, plus souvent sur un début de phrase ; le premier temps d'un drop
 *   en reçoit toujours un.
 * - Filtre par difficulté minimale et par section (la pluie : seulement dans les drops).
 * - Jamais deux fois la même famille d'affilée (sauf s'il n'y a pas d'autre choix).
 * - Chaque candidat est validé par isSurvivable AVEC les dangers déjà en vol, depuis
 *   la position réelle du joueur, au moment où son avertissement apparaît.
 */
export class PatternDirector {
  private nextSlot = Infinity;
  private lastFamily: string | null = null;
  private forced: string | null = null;

  constructor(
    private readonly library: readonly PatternDef[],
    private readonly rng: Rng,
    private readonly warnBeats = WARN_BEATS,
    private readonly fairness: SurvivabilityOptions = DEFAULT_SURVIVABILITY,
  ) {}

  /** Familles dans l'ordre de la bibliothèque (touches de debug). */
  get families(): string[] {
    return this.library.map((d) => d.family);
  }

  /** Famille forcée au prochain créneau (debug), si elle n'a pas encore été jouée. */
  get forcedFamily(): string | null {
    return this.forced;
  }

  /** Debug : force une famille au prochain créneau, en ignorant section et difficulté (pas l'équité). */
  force(family: string): void {
    if (this.families.includes(family)) this.forced = family;
  }

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
    const sec = ctx.sectionAt(slot) ?? FALLBACK_SECTION;
    const difficulty = difficultyOf(sec);
    const grid = difficulty >= GRID_1_BEAT_DIFFICULTY ? 1 : difficulty >= GRID_2_BEATS_DIFFICULTY ? 2 : BEATS_PER_BAR;

    // Créneau raté (onglet gelé…) : on ne lance pas un avertissement déjà entamé.
    if (slot - this.warnBeats < ctx.beat - COMMIT_AHEAD_BEATS) {
      this.nextSlot = Math.ceil((ctx.beat + this.warnBeats + COMMIT_AHEAD_BEATS) / grid) * grid;
      return null;
    }

    const pattern = this.place(slot, sec, difficulty, ctx);
    const rest = lerp(REST_BEATS_EASY, REST_BEATS_HARD, difficulty);
    const end = pattern ? slot + patternLength(pattern) + rest : slot + 1;
    this.nextSlot = Math.ceil(end / grid) * grid;
    return pattern;
  }

  /** Ordre d'essai des familles pour ce créneau. */
  private candidates(slot: number, sec: SectionInfo, difficulty: number): PatternDef[] {
    if (this.forced) {
      const forced = this.library.filter((d) => d.family === this.forced);
      this.forced = null;
      return forced;
    }
    const eligible = this.library.filter(
      (d) => difficulty >= d.minIntensity && (!d.sections || d.sections.includes(sec.name)),
    );
    const small = eligible.filter((d) => !d.big);
    const big = eligible.filter((d) => d.big);

    const barStart = slot % BEATS_PER_BAR === 0;
    if (!barStart || big.length === 0) return this.weightedOrder(small);

    const phraseStart = slot % (BARS_PER_PHRASE * BEATS_PER_BAR) === 0;
    const dropStart = slot === sec.beat && sec.name.startsWith('DROP');
    const chance =
      lerp(BIG_PATTERN_CHANCE_EASY, BIG_PATTERN_CHANCE_HARD, difficulty) + (phraseStart ? BIG_PATTERN_PHRASE_BONUS : 0);
    const wantBig = dropStart || this.rng() < chance;
    return wantBig
      ? [...this.weightedOrder(big), ...this.weightedOrder(small)]
      : [...this.weightedOrder(small), ...this.weightedOrder(big)];
  }

  /** Tirage pondéré sans remise ; la dernière famille jouée passe en fin de liste. */
  private weightedOrder(defs: readonly PatternDef[]): PatternDef[] {
    const keyed = defs.map((d) => ({ d, key: Math.pow(this.rng(), 1 / (d.weight ?? 1)) }));
    keyed.sort((a, b) => b.key - a.key);
    const out = keyed.map((k) => k.d);
    out.sort((a, b) => Number(a.family === this.lastFamily) - Number(b.family === this.lastFamily));
    return out;
  }

  private place(slot: number, sec: SectionInfo, difficulty: number, ctx: DirectorContext): Pattern | null {
    const existing: HazardSpec[] = ctx.hazards.upcoming(ctx.beat).filter((h) => h.impactBeat > ctx.beat);

    for (const def of this.candidates(slot, sec, difficulty)) {
      for (const pattern of shuffled(this.rng, def.variants(this.rng, difficulty))) {
        const specs = instantiate(pattern, slot, this.warnBeats);
        const impacts = toImpacts([...existing, ...specs], ctx.tempo, ctx.now);
        if (!isSurvivable(impacts, ctx.playerCell, this.fairness)) continue;
        for (const s of specs) ctx.hazards.add(s);
        this.lastFamily = def.family;
        return pattern;
      }
    }
    return null;
  }
}
