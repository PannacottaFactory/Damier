import { describe, expect, it } from 'vitest';
import { FADE_BEATS, MOVE_TWEEN_MS } from '../src/config';
import { TempoMap } from '../src/core/clock';
import { findHit } from '../src/game/collision';
import { HazardField, hazardPhase } from '../src/game/hazards';
import { Player } from '../src/game/player';

const H = { patternId: 't', family: 't', cells: [12], warnBeat: 2, impactBeat: 4, impactLen: 0.25 };

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

describe('fantômes (call & response)', () => {
  const G = { ...H, ghost: true };

  it('ne sont jamais mortels ni comptés pour l’équité', () => {
    const f = new HazardField();
    f.add(G);
    expect(f.isLethal(12, 4.1)).toBe(false);
    expect(f.impactStartsBetween(3, 5)).toEqual([]);
    expect(f.impactsAt(4)).toBe(0);
    expect(f.upcoming(3)).toEqual([]);
  });

  it('s’affichent en avertissement puis en flash de contour', () => {
    const f = new HazardField();
    f.add(G);
    expect(f.cellStates(3)[12].warn).toBeGreaterThan(0);
    const s = f.cellStates(4.1)[12];
    expect(s.impact).toBe(0);
    expect(s.ghost).toBeGreaterThan(0);
  });
});

describe('affichage des avertissements', () => {
  it('seul le prochain impact est en plein, les suivants en discret', () => {
    const f = new HazardField();
    f.add({ ...H, cells: [0], warnBeat: 2, impactBeat: 4 });
    f.add({ ...H, cells: [1], warnBeat: 3, impactBeat: 5 });
    const s = f.cellStates(3.5);
    expect(s[0].warn).toBeGreaterThan(0);
    expect(s[0].later).toBe(0);
    expect(s[1].warn).toBe(0);
    expect(s[1].later).toBeGreaterThan(0);
    // Après le premier impact, le second devient « le prochain ».
    expect(f.cellStates(4.5)[1].warn).toBeGreaterThan(0);
  });
});
