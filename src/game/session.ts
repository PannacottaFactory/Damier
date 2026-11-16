import type { GameState } from '../core/state';
import type { Rng } from '../core/random';
import { LIBRARY } from '../patterns/library';
import { type BeatTime, PatternDirector, type SectionInfo } from '../patterns/director';
import { findHit } from './collision';
import type { Cell, Dir } from './grid';
import { HazardField } from './hazards';
import { Player } from './player';

/**
 * Une partie : joueur + dangers + director + état (PLAYING / DEAD).
 * Pure logique : aucune dépendance au canvas ni à l'audio, le temps est fourni de l'extérieur.
 */
export class GameSession {
  state: GameState = 'MENU';
  readonly player = new Player();
  readonly hazards = new HazardField();
  readonly director: PatternDirector;

  /** Debug : on ne meurt pas. */
  invincible = false;
  death: { time: number; cell: Cell } | null = null;
  lastPatternId: string | null = null;

  private lastBeat = -Infinity;

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
  }

  move(dir: Dir, now: number): void {
    if (this.state === 'PLAYING') this.player.requestMove(dir, now);
  }

  update(now: number): void {
    const beat = this.tempo.beatAt(now);
    this.player.update(now);

    if (this.state === 'PLAYING') {
      const pattern = this.director.update({
        beat,
        now,
        tempo: this.tempo,
        playerCell: this.player.targetCell(),
        hazards: this.hazards,
        sectionAt: this.sectionAt,
      });
      if (pattern) this.lastPatternId = pattern.id;

      const hit = findHit(this.player, this.hazards, this.tempo, this.lastBeat, beat, now);
      if (hit && !this.invincible) this.die(hit.time, hit.cell, beat);
    }

    this.hazards.prune(beat);
    this.lastBeat = beat;
  }

  private die(time: number, cell: Cell, beat: number): void {
    this.state = 'DEAD';
    this.death = { time, cell };
    this.director.stop();
    // Les dangers pas encore tombés disparaissent ; celui qui a tué reste visible.
    this.hazards.cancelAfter(beat);
  }
}
