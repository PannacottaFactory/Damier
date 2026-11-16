import { describe, expect, it } from 'vitest';
import { FADE_BEATS, MOVE_TWEEN_MS } from '../src/config';
import { TempoMap } from '../src/core/clock';
import { createRng } from '../src/core/random';
import { findHit } from '../src/game/collision';
import { HazardField, hazardPhase } from '../src/game/hazards';
import { Player } from '../src/game/player';
import { BASIC_PATTERNS } from '../src/patterns/library/basic';
import { PatternDirector, toImpacts } from '../src/patterns/director';
import { DEFAULT_SURVIVABILITY, isSurvivable } from '../src/patterns/survivability';

const H = { patternId: 't', cells: [12], warnBeat: 2, impactBeat: 4, impactLen: 0.25 };

describe('cycle d’un danger', () => {
  it('pending → warning → impact → fade → done', () => {
    const h = { ...H, id: 1 };
    expect(hazardPhase(h, 1.9)).toBe('pending');
    expect(hazardPhase(h, 2)).toBe('warning');
    expect(hazardPhase(h, 3.99)).toBe('warning');
    expect(hazardPhase(h, 4)).toBe('impact');
    expect(hazardPhase(h, 4.24)).toBe('impact');
    expect(hazardPhase(h, 4.25)).toBe('fade');
    expect(hazardPhase(h, 4.25 + FADE_BEATS)).toBe('done');
  });

  it('seul l’impact est mortel', () => {
    const f = new HazardField();
    f.add(H);
    expect(f.isLethal(12, 3.9)).toBe(false);
    expect(f.isLethal(12, 4.1)).toBe(true);
    expect(f.isLethal(11, 4.1)).toBe(false);
    expect(f.isLethal(12, 4.3)).toBe(false);
  });
});

describe('collisions', () => {
  const tempo = new TempoMap(120, 0); // 1 beat = 0,5 s → impact à t = 2 s
  const T = MOVE_TWEEN_MS / 1000;

  it('touché si on est sur la case au début de l’impact, même si la frame arrive après', () => {
    const f = new HazardField();
    f.add(H);
    const p = new Player({ x: 2, y: 2 });
    // Le joueur part à t = 2,0 s pile : à l'impact il est encore sur la case.
    p.requestMove('right', 2.0);
    expect(findHit(p, f, tempo, 3.9, tempo.beatAt(2.1), 2.1)).not.toBeNull();
  });

  it('hitbox indulgente : sauvé s’il a passé la mi-tween au début de l’impact', () => {
    const f = new HazardField();
    f.add(H);
    const p = new Player({ x: 2, y: 2 });
    p.requestMove('right', 2.0 - T * 0.5);
    expect(findHit(p, f, tempo, 3.9, tempo.beatAt(2.1), 2.1)).toBeNull();
  });

  it('entrer dans une case pendant son impact tue', () => {
    const f = new HazardField();
    f.add(H);
    const p = new Player({ x: 1, y: 2 });
    p.requestMove('right', 2.02);
    const now = 2.02 + T;
    expect(findHit(p, f, tempo, tempo.beatAt(2.01), tempo.beatAt(now), now)).not.toBeNull();
  });
});

describe('PatternDirector', () => {
  it('ne propose jamais de pattern insurvivable (fuzz)', () => {
    const tempo = new TempoMap(128, 0);
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      const hazards = new HazardField();
      const director = new PatternDirector(BASIC_PATTERNS, rng);
      director.reset(0);
      let committed = 0;
      // Joueur aléatoire, simulé à 60 fps sur 40 mesures.
      let cell = { x: randInt(rng), y: randInt(rng) };
      for (let frame = 0; frame < 60 * 75; frame++) {
        const now = frame / 60;
        const beat = tempo.beatAt(now);
        if (frame % 20 === 0) cell = { x: randInt(rng), y: randInt(rng) };
        const before = hazards.all().length;
        director.update({ beat, now, tempo, playerCell: cell, hazards, intensity: 0.8 });
        if (hazards.all().length > before) {
          committed++;
          const upcoming = hazards.upcoming(beat).filter((h) => h.impactBeat > beat);
          expect(isSurvivable(toImpacts(upcoming, tempo, now), cell, DEFAULT_SURVIVABILITY)).toBe(true);
        }
        hazards.prune(beat);
      }
      expect(committed).toBeGreaterThan(20);
    }

    function randInt(rng: () => number) {
      return Math.floor(rng() * 5);
    }
  });

  it('les impacts tombent sur un temps (début de mesure)', () => {
    const tempo = new TempoMap(128, 0);
    const hazards = new HazardField();
    const director = new PatternDirector(BASIC_PATTERNS, createRng(7));
    director.reset(0);
    for (let beat = 0; beat < 40; beat += 0.05) {
      director.update({ beat, now: tempo.timeAt(beat), tempo, playerCell: { x: 2, y: 2 }, hazards, intensity: 1 });
    }
    expect(hazards.all().length).toBeGreaterThan(0);
    for (const h of hazards.all()) expect(h.impactBeat % 4).toBe(0);
  });

  it('n’enchaîne pas deux fois la même famille quand il a le choix', () => {
    const tempo = new TempoMap(128, 0);
    const hazards = new HazardField();
    const director = new PatternDirector(BASIC_PATTERNS, createRng(3));
    director.reset(0);
    const families: string[] = [];
    for (let beat = 0; beat < 200; beat += 0.05) {
      const p = director.update({ beat, now: tempo.timeAt(beat), tempo, playerCell: { x: 0, y: 0 }, hazards, intensity: 1 });
      if (p) families.push(p.family);
      hazards.prune(beat);
    }
    for (let i = 1; i < families.length; i++) expect(families[i]).not.toBe(families[i - 1]);
  });
});
