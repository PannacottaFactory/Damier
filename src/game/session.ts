import { NEAR_MISS_WINDOW_MS, RESTART_LOCK_MS } from '../config';
import type { GameState } from '../core/state';
import type { Rng } from '../core/random';
import { LIBRARY } from '../patterns/library';
import { type BeatTime, PatternDirector, type SectionInfo } from '../patterns/director';
import { findHit } from './collision';
import { type Cell, cellIndex, type Dir } from './grid';
import { HazardField } from './hazards';
import { Player } from './player';
import { computeScore } from './score';

/** Ce qui s'est passé pendant une frame, consommé par main (records, statistiques, effets). */
export type SessionEvent =
  | { type: 'death'; time: number; survived: number; score: number; nearMisses: number; killers: string[] }
  | { type: 'patternSurvived'; family: string }
  | { type: 'nearMiss'; time: number; cell: Cell };

export interface DeathInfo {
  time: number;
  cell: Cell;
  /** Temps de survie de la partie (s). */
  survived: number;
  score: number;
  /** Familles des patterns qui ont tué. */
  killers: string[];
}

/** Petite avance pour les comparaisons de beats. */
const BEAT_EPS = 1e-6;

/**
 * Une partie : joueur + dangers + director + chrono/score + état (PLAYING / DEAD).
 * Pure logique : aucune dépendance au canvas ni à l'audio, le temps est fourni de l'extérieur.
 */
export class GameSession {
  state: GameState = 'MENU';
  readonly player = new Player();
  readonly hazards = new HazardField();
  readonly director: PatternDirector;

  /** Debug : on ne meurt pas (et rien n'est compté dans les statistiques). */
  invincible = false;
  death: DeathInfo | null = null;
  lastPatternId: string | null = null;
  nearMisses = 0;
  /** Near misses récents (affichage du « +250 »). */
  readonly nearMissLog: { time: number; cell: Cell }[] = [];

  private runStart = 0;
  private lastBeat = -Infinity;
  private lastNearMissBeat = -Infinity;
  /** Patterns engagés et pas encore terminés : famille + beat de fin du dernier impact. */
  private active: { family: string; endBeat: number }[] = [];
  private events: SessionEvent[] = [];

  constructor(
    private readonly tempo: BeatTime,
    rng: Rng,
    /** Section musicale qui jouera à un beat donné (fournie par l'audio). */
    private readonly sectionAt: (beat: number) => SectionInfo | null,
  ) {
    this.director = new PatternDirector(LIBRARY, rng);
  }

  /** (Re)lance une partie immédiatement. */
  restart(now: number): void {
    const beat = this.tempo.beatAt(now);
    this.player.reset();
    this.hazards.clear();
    this.director.reset(beat);
    this.state = 'PLAYING';
    this.death = null;
    this.lastPatternId = null;
    this.lastBeat = beat;
    this.lastNearMissBeat = -Infinity;
    this.runStart = now;
    this.nearMisses = 0;
    this.nearMissLog.length = 0;
    this.active = [];
  }

  /** Espace ne relance qu'après un court délai : on a le temps de voir ce qui nous a eus. */
  canRestart(now: number): boolean {
    return this.state === 'DEAD' && this.death !== null && now - this.death.time >= RESTART_LOCK_MS / 1000;
  }

  move(dir: Dir, now: number): void {
    if (this.state === 'PLAYING') this.player.requestMove(dir, now);
  }

  /** Temps de survie de la partie en cours (figé à la mort). */
  survivalTime(now: number): number {
    if (this.state === 'MENU') return 0;
    return Math.max(0, (this.death ? this.death.time : now) - this.runStart);
  }

  score(now: number): number {
    return this.death ? this.death.score : computeScore(this.survivalTime(now), this.nearMisses);
  }

  /** Événements depuis le dernier appel. */
  drainEvents(): SessionEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  update(now: number): void {
    const beat = this.tempo.beatAt(now);
    this.player.update(now);

    if (this.state === 'PLAYING') {
      const before = this.hazards.all().length;
      const pattern = this.director.update({
        beat,
        now,
        tempo: this.tempo,
        playerCell: this.player.targetCell(),
        hazards: this.hazards,
        sectionAt: this.sectionAt,
      });
      if (pattern) {
        this.lastPatternId = pattern.id;
        // Fin du pattern : fin de son dernier impact réel (les fantômes ne tuent pas).
        const added = this.hazards.all().slice(before).filter((h) => !h.ghost);
        const endBeat = Math.max(...added.map((h) => h.impactBeat + h.impactLen));
        if (added.length > 0) this.active.push({ family: pattern.family, endBeat });
      }

      const hit = findHit(this.player, this.hazards, this.tempo, this.lastBeat, beat, now);
      if (hit && !this.invincible) {
        this.die(hit.time, hit.cell, beat, [...new Set(hit.hazards.map((h) => h.family))]);
      } else {
        this.detectNearMisses(beat);
        this.completePatterns(beat);
      }
    }

    this.hazards.prune(beat);
    this.lastBeat = beat;
  }

  /**
   * Near miss : une case explose alors qu'on l'occupait encore il y a moins de
   * NEAR_MISS_WINDOW_MS, et qu'on en est sorti à temps.
   */
  private detectNearMisses(beat: number): void {
    const window = NEAR_MISS_WINDOW_MS / 1000;
    for (const h of this.hazards.startingBetween(this.lastBeat, beat)) {
      if (h.impactBeat <= this.lastNearMissBeat + BEAT_EPS) continue;
      const t = this.tempo.timeAt(h.impactBeat);
      const now = cellIndex(this.player.cellAt(t));
      const before = this.player.cellAt(t - window);
      if (h.cells.includes(now) || !h.cells.includes(cellIndex(before))) continue;
      this.lastNearMissBeat = h.impactBeat;
      this.nearMisses++;
      this.nearMissLog.push({ time: t, cell: before });
      if (this.nearMissLog.length > 8) this.nearMissLog.shift();
      this.events.push({ type: 'nearMiss', time: t, cell: before });
    }
  }

  /** Patterns allés au bout sans tuer : comptés comme « survécus » (sauf en mode invincible). */
  private completePatterns(beat: number): void {
    const done = this.active.filter((p) => p.endBeat <= beat);
    if (done.length === 0) return;
    this.active = this.active.filter((p) => p.endBeat > beat);
    if (this.invincible) return;
    for (const p of done) this.events.push({ type: 'patternSurvived', family: p.family });
  }

  private die(time: number, cell: Cell, beat: number, killers: string[]): void {
    const survived = Math.max(0, time - this.runStart);
    this.state = 'DEAD';
    this.death = { time, cell, survived, score: computeScore(survived, this.nearMisses), killers };
    this.director.stop();
    this.active = [];
    // Les dangers pas encore tombés disparaissent ; celui qui a tué reste visible.
    this.hazards.cancelAfter(beat);
    this.events.push({
      type: 'death',
      time,
      survived,
      score: this.death.score,
      nearMisses: this.nearMisses,
      killers,
    });
  }
}
