import { describe, expect, it } from 'vitest';
import { sectionAtBeat } from '../src/audio/arrangement';
import { LEVEL1 } from '../src/audio/songs/level1';
import { TempoMap } from '../src/core/clock';
import { createRng } from '../src/core/random';
import { HazardField } from '../src/game/hazards';
import { difficultyOf, PatternDirector, type SectionInfo, toImpacts } from '../src/patterns/director';
import { LIBRARY } from '../src/patterns/library';
import { DEFAULT_SURVIVABILITY, isSurvivable } from '../src/patterns/survivability';

const tempo = new TempoMap(128, 0);
const INTRO = { index: 0, name: 'INTRO' as const, intensity: 0.2, bars: 8, loop: 0, beat: 0 };
const sectionAt = (beat: number): SectionInfo => sectionAtBeat(LEVEL1, INTRO, beat);
const defOf = (family: string) => LIBRARY.find((d) => d.family === family)!;

interface Placement {
  family: string;
  id: string;
  start: number;
  section: SectionInfo;
}

/** Fait tourner le director sur `bars` mesures du niveau 1, avec un joueur qui bouge au hasard. */
function simulate(seed: number, bars: number, onCommit?: (hazards: HazardField, beat: number, now: number, cell: { x: number; y: number }) => void) {
  const rng = createRng(seed);
  const hazards = new HazardField();
  const director = new PatternDirector(LIBRARY, rng);
  director.reset(0);
  const placements: Placement[] = [];
  let cell = { x: 2, y: 2 };
  const fps = 30;
  for (let frame = 0; ; frame++) {
    const now = frame / fps;
    const beat = tempo.beatAt(now);
    if (beat > bars * 4) break;
    if (frame % 10 === 0) cell = { x: Math.floor(rng() * 5), y: Math.floor(rng() * 5) };
    const before = hazards.all().length;
    const p = director.update({ beat, now, tempo, playerCell: cell, hazards, sectionAt });
    if (p) {
      const added = hazards.all().slice(before);
      const start = Math.min(...added.map((h) => h.impactBeat));
      placements.push({ family: p.family, id: p.id, start, section: sectionAt(start) });
      onCommit?.(hazards, beat, now, cell);
    }
    hazards.prune(beat);
  }
  return { placements, hazards, director };
}

describe('PatternDirector', () => {
  // Deux tours complets du morceau : INTRO → … → DROP2 → BREAK → DROP2.
  const BARS = 104;
  const runs = Array.from({ length: 12 }, (_, i) => simulate(i + 1, BARS));
  const all = runs.flatMap((r) => r.placements);

  it('ne propose jamais de pattern insurvivable (fuzz, joueur aléatoire)', () => {
    for (let seed = 100; seed < 106; seed++) {
      let checked = 0;
      simulate(seed, BARS, (hazards, beat, now, cell) => {
        const upcoming = hazards.upcoming(beat).filter((h) => h.impactBeat > beat);
        expect(isSurvivable(toImpacts(upcoming, tempo, now), cell, DEFAULT_SURVIVABILITY)).toBe(true);
        checked++;
      });
      expect(checked).toBeGreaterThan(40);
    }
  });

  it('toutes les familles finissent par apparaître', () => {
    const seen = new Set(all.map((p) => p.family));
    for (const def of LIBRARY) expect(seen.has(def.family), def.family).toBe(true);
  });

  it('respecte la difficulté minimale et les sections autorisées', () => {
    for (const p of all) {
      const def = defOf(p.family);
      expect(difficultyOf(p.section), `${p.id} en ${p.section.name}`).toBeGreaterThanOrEqual(def.minIntensity);
      if (def.sections) expect(def.sections).toContain(p.section.name);
    }
    // La pluie n'apparaît que dans les drops.
    expect(all.filter((p) => p.family === 'rain').every((p) => p.section.name.startsWith('DROP'))).toBe(true);
  });

  it('les gros patterns démarrent sur un début de mesure, les autres sur un temps', () => {
    for (const p of all) {
      if (defOf(p.family).big) expect(p.start % 4, p.id).toBe(0);
      else expect(p.start % 1, p.id).toBe(0);
    }
  });

  it('chaque drop démarre sur un gros pattern', () => {
    let drops = 0;
    for (const r of runs) {
      for (const p of r.placements) {
        if (p.start === p.section.beat && p.section.name.startsWith('DROP')) {
          drops++;
          expect(defOf(p.family).big, p.id).toBe(true);
        }
      }
    }
    expect(drops).toBeGreaterThan(runs.length);
  });

  it('plus dense dans les drops que dans l’intro', () => {
    const count = (name: string) => all.filter((p) => p.section.name === name).length / LEVEL1.sections.find((s) => s.name === name)!.bars;
    expect(count('DROP2')).toBeGreaterThan(count('INTRO') * 2);
  });

  it('n’enchaîne pas deux fois la même famille', () => {
    for (const r of runs) {
      for (let i = 1; i < r.placements.length; i++) expect(r.placements[i].family).not.toBe(r.placements[i - 1].family);
    }
  });

  it('les impacts tombent sur la grille des doubles croches', () => {
    for (const r of runs) for (const h of r.hazards.all()) expect((h.impactBeat * 4) % 1).toBe(0);
  });

  it('debug : une famille forcée est jouée au créneau suivant, même hors section', () => {
    const hazards = new HazardField();
    const director = new PatternDirector(LIBRARY, createRng(5));
    director.reset(0);
    director.force('rain');
    let played = null;
    for (let beat = 0; beat < 20 && !played; beat += 0.05) {
      played = director.update({ beat, now: tempo.timeAt(beat), tempo, playerCell: { x: 2, y: 2 }, hazards, sectionAt });
    }
    expect(played?.family).toBe('rain');
    expect(director.forcedFamily).toBeNull();
  });
});
