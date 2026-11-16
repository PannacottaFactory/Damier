import { describe, expect, it } from 'vitest';
import { MOVE_TWEEN_MS, NEAR_MISS_POINTS, RANKS, SCORE_PER_SECOND, UNLOCK_SECONDS } from '../src/config';
import { TempoMap } from '../src/core/clock';
import { createRng } from '../src/core/random';
import { memoryStore } from '../src/core/storage';
import { PatternStats } from '../src/game/patternStats';
import { Records } from '../src/game/records';
import { computeScore, formatTime, rankIndex, rankName, timeSinceRankUp } from '../src/game/score';
import { GameSession } from '../src/game/session';

describe('score et rangs', () => {
  it('un rang toutes les 10 s, plafonné à TRANSE', () => {
    expect(rankName(0)).toBe('PULSE');
    expect(rankName(9.99)).toBe('PULSE');
    expect(rankName(10)).toBe('BEAT');
    expect(rankName(25)).toBe('GROOVE');
    expect(rankName(40)).toBe('TRANSE');
    expect(rankName(500)).toBe('TRANSE');
    expect(rankIndex(500)).toBe(RANKS.length - 1);
  });

  it('temps depuis le dernier rang', () => {
    expect(timeSinceRankUp(5)).toBe(Infinity);
    expect(timeSinceRankUp(10.5)).toBeCloseTo(0.5);
    expect(timeSinceRankUp(41)).toBeCloseTo(1);
  });

  it('score = temps + near misses + bonus', () => {
    expect(computeScore(12.345, 0)).toBe(Math.floor(12.345 * SCORE_PER_SECOND));
    expect(computeScore(10, 3, 500)).toBe(10 * SCORE_PER_SECOND + 3 * NEAR_MISS_POINTS + 500);
  });

  it('chrono : secondes + centièmes', () => {
    expect(formatTime(0)).toBe('0.00');
    expect(formatTime(12.3456)).toBe('12.34');
    expect(formatTime(7.05)).toBe('7.05');
    expect(formatTime(-1)).toBe('0.00');
  });
});

describe('records (localStorage)', () => {
  it('garde le meilleur temps et le meilleur score, et le signale', () => {
    const store = memoryStore();
    const r = new Records(store);
    expect(r.get(1)).toEqual({ bestTime: 0, bestScore: 0, runs: 0 });
    expect(r.submit(1, 12, 1500)).toMatchObject({ newBestTime: true, newBestScore: true });
    const second = r.submit(1, 8, 1800);
    expect(second).toMatchObject({ newBestTime: false, newBestScore: true });
    expect(second.previous.bestTime).toBe(12);
    expect(r.get(1)).toEqual({ bestTime: 12, bestScore: 1800, runs: 2 });
    // Persisté : une nouvelle instance relit les données.
    expect(new Records(store).get(1).bestTime).toBe(12);
  });

  it('données corrompues → on repart de zéro sans planter', () => {
    const store = memoryStore();
    store.set('pulsegrid.records.v1', '{pas du json');
    expect(new Records(store).get(1).bestTime).toBe(0);
    store.set('pulsegrid.records.v1', JSON.stringify({ 1: { bestTime: 'abc', bestScore: -5 } }));
    expect(new Records(store).get(1)).toEqual({ bestTime: 0, bestScore: 0, runs: 0 });
  });

  it('déblocage : niveau N ouvert en tenant 60 s au niveau N-1', () => {
    const r = new Records(memoryStore());
    expect(r.isUnlocked(1)).toBe(true);
    expect(r.isUnlocked(2)).toBe(false);
    r.submit(1, UNLOCK_SECONDS - 0.01, 0);
    expect(r.isUnlocked(2)).toBe(false);
    r.submit(1, UNLOCK_SECONDS, 0);
    expect(r.isUnlocked(2)).toBe(true);
    expect(r.isUnlocked(3)).toBe(false);
  });
});

describe('statistiques de mort par pattern', () => {
  it('compte, trie par taux de mort, persiste et se remet à zéro', () => {
    const store = memoryStore();
    const s = new PatternStats(store);
    s.survived('line');
    s.survived('line');
    s.survived('spiral');
    s.died(['spiral', 'spiral']); // dédoublonné
    s.died(['line']);
    const rows = new PatternStats(store).rows();
    expect(rows.map((r) => [r.family, r.deaths, r.survived])).toEqual([
      ['spiral', 1, 1],
      ['line', 1, 2],
    ]);
    expect(rows[0].rate).toBeCloseTo(0.5);
    s.reset();
    expect(new PatternStats(store).rows()).toEqual([]);
  });
});

describe('session : mort, near miss, statistiques', () => {
  const tempo = new TempoMap(120, 0); // 1 beat = 0,5 s
  const T = MOVE_TWEEN_MS / 1000;
  const HAZARD = { patternId: 'p', family: 'line', cells: [12], warnBeat: 2, impactBeat: 4, impactLen: 0.25 };

  /** Session sans director (dangers posés à la main), jouée frame par frame jusqu'à `until`. */
  function setup() {
    const s = new GameSession(tempo, createRng(1), () => null);
    s.restart(0);
    s.director.stop();
    s.hazards.add(HAZARD);
    const run = (from: number, until: number, onFrame?: (t: number) => void) => {
      for (let t = from; t <= until + 1e-9; t += 1 / 60) {
        onFrame?.(t);
        s.update(t);
      }
    };
    return { s, run };
  }

  it('mort : événement avec le pattern coupable, chrono et score figés', () => {
    const { s, run } = setup();
    run(0, 2.5);
    expect(s.state).toBe('DEAD');
    const events = s.drainEvents();
    const death = events.find((e) => e.type === 'death');
    expect(death).toMatchObject({ type: 'death', killers: ['line'] });
    expect(s.survivalTime(2.5)).toBeCloseTo(2, 5);
    expect(s.survivalTime(10)).toBeCloseTo(2, 5);
    expect(s.score(10)).toBe(s.death!.score);
  });

  it('relance verrouillée un court instant après la mort', () => {
    const { s, run } = setup();
    run(0, 2.05);
    expect(s.canRestart(2.05)).toBe(false);
    expect(s.canRestart(2.3)).toBe(true);
  });

  it('near miss : quitter la case juste avant son impact', () => {
    const { s, run } = setup();
    let moved = false;
    run(0, 2.6, (t) => {
      if (!moved && t >= 2 - T) {
        s.move('right', t);
        moved = true;
      }
    });
    expect(s.state).toBe('PLAYING');
    expect(s.nearMisses).toBe(1);
    expect(s.drainEvents().some((e) => e.type === 'nearMiss')).toBe(true);
    expect(s.score(2.6)).toBe(computeScore(2.6, 1));
  });

  it('pas de near miss si on est parti depuis longtemps', () => {
    const { s, run } = setup();
    let moved = false;
    run(0, 2.6, (t) => {
      if (!moved && t >= 1) {
        s.move('right', t);
        moved = true;
      }
    });
    expect(s.nearMisses).toBe(0);
  });

  it('un pattern allé au bout sans tuer compte comme survécu (sauf en invincible)', () => {
    /** Bot simple : s'il est sur une case menacée, il va sur une voisine non menacée. */
    const play = (invincible: boolean) => {
      const s = new GameSession(tempo, createRng(4), () => null);
      s.invincible = invincible;
      s.restart(0);
      const events: string[] = [];
      for (let t = 0; t < 40 && s.state === 'PLAYING'; t += 1 / 60) {
        const beat = tempo.beatAt(t);
        const threatened = new Set(s.hazards.upcoming(beat).flatMap((h) => h.cells));
        const c = s.player.targetCell();
        if (threatened.has(c.y * 5 + c.x) && !s.player.isMoving(t)) {
          const dirs = (['up', 'down', 'left', 'right'] as const).filter((d) => {
            const n = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
            const x = c.x + n[0];
            const y = c.y + n[1];
            return x >= 0 && x < 5 && y >= 0 && y < 5 && !threatened.has(y * 5 + x);
          });
          if (dirs.length > 0) s.move(dirs[0], t);
        }
        s.update(t);
        events.push(...s.drainEvents().map((e) => (e.type === 'patternSurvived' ? 'survived' : e.type)));
      }
      return events;
    };
    expect(play(false).filter((e) => e === 'survived').length).toBeGreaterThan(0);
    expect(play(true).filter((e) => e === 'survived' || e === 'death')).toEqual([]);
  });
});
