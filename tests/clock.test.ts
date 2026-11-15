import { describe, expect, it } from 'vitest';
import { musicalPosition, TempoMap } from '../src/core/clock';

describe('TempoMap — conversion temps ↔ beats', () => {
  it('à 120 BPM, 1 beat = 0,5 s', () => {
    const t = new TempoMap(120, 10);
    expect(t.beatAt(10)).toBe(0);
    expect(t.beatAt(11)).toBeCloseTo(2);
    expect(t.timeAt(4)).toBeCloseTo(12);
  });

  it('est réversible (aller-retour)', () => {
    const t = new TempoMap(128, 3.21);
    for (const b of [0, 0.25, 1, 7.75, 123.5]) expect(t.beatAt(t.timeAt(b))).toBeCloseTo(b, 9);
  });

  it('extrapole avant le départ (beats négatifs)', () => {
    const t = new TempoMap(60, 5);
    expect(t.beatAt(4)).toBeCloseTo(-1);
  });

  it('changement de tempo : continu au point de bascule, plus lent ensuite', () => {
    const t = new TempoMap(120, 0);
    const switchTime = t.timeAt(8); // 4 s
    t.setTempo(60, 8);
    expect(t.timeAt(8)).toBeCloseTo(switchTime);
    expect(t.beatAt(switchTime)).toBeCloseTo(8);
    // Avant la bascule : inchangé.
    expect(t.timeAt(4)).toBeCloseTo(2);
    // Après : 1 beat = 1 s.
    expect(t.timeAt(10)).toBeCloseTo(6);
    expect(t.bpmAtBeat(9)).toBe(60);
    expect(t.bpmAtTime(1)).toBe(120);
  });

  it('enchaîne ralenti puis retour au tempo normal (bonus Ralenti)', () => {
    const t = new TempoMap(128, 0);
    t.setTempo(128 * 0.85, 16);
    t.setTempo(128, 24);
    const slowLen = t.timeAt(24) - t.timeAt(16);
    expect(slowLen).toBeCloseTo((8 * 60) / (128 * 0.85));
    expect(t.timeAt(25) - t.timeAt(24)).toBeCloseTo(60 / 128);
    for (const b of [3, 17.5, 30]) expect(t.beatAt(t.timeAt(b))).toBeCloseTo(b, 9);
  });

  it('un nouveau setTempo remplace les changements postérieurs', () => {
    const t = new TempoMap(100, 0);
    t.setTempo(50, 10);
    t.setTempo(200, 4);
    expect(t.bpmAtBeat(12)).toBe(200);
  });
});

describe('musicalPosition', () => {
  it('découpe beat → mesure / temps / step / phrases', () => {
    const p = musicalPosition(4 * 9 + 2.6); // mesure 9 (0-indexée), temps 2, 3e double croche
    expect(p.bar).toBe(9);
    expect(p.beatInBar).toBe(2);
    expect(p.stepInBar).toBe(2 * 4 + 2);
    expect(p.barInPhrase4).toBe(1);
    expect(p.barInPhrase8).toBe(1);
    expect(p.barInPhrase16).toBe(9);
  });

  it('reste cohérent avant le départ (beats négatifs)', () => {
    const p = musicalPosition(-0.5);
    expect(p.bar).toBe(-1);
    expect(p.beatInBar).toBe(3);
    expect(p.barInPhrase4).toBe(3);
  });

  it('tombe pile sur le step malgré les erreurs flottantes', () => {
    expect(musicalPosition(0.75 - 1e-12).step).toBe(3);
  });
});
