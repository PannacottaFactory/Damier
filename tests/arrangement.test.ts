import { describe, expect, it } from 'vitest';
import { advanceBar, chordIndexAt, nextSectionStart, SONG_START, sectionAtBeat, sectionOf } from '../src/audio/arrangement';
import { LEVEL1 } from '../src/audio/songs/level1';

describe('arrangement', () => {
  it('suit la structure INTRO → BUILD → DROP → BREAK → DROP2 puis reboucle', () => {
    const names: string[] = [];
    let pos = SONG_START;
    let lastName = '';
    // Assez de mesures pour faire deux tours de boucle.
    for (let i = 0; i < 120; i++) {
      const name = sectionOf(LEVEL1, pos).name;
      if (pos.barInSection === 0 && (name !== lastName || names.length === 0)) names.push(name);
      lastName = name;
      pos = advanceBar(LEVEL1, pos);
    }
    expect(names.slice(0, 7)).toEqual(['INTRO', 'BUILD', 'DROP', 'BREAK', 'DROP2', 'BREAK', 'DROP2']);
  });

  it('respecte la durée des sections', () => {
    let pos = SONG_START;
    for (let i = 0; i < 8; i++) pos = advanceBar(LEVEL1, pos);
    expect(sectionOf(LEVEL1, pos).name).toBe('BUILD');
    expect(pos.barInSection).toBe(0);
  });

  it('compte les boucles', () => {
    const last = { section: LEVEL1.sections.length - 1, barInSection: 3, loop: 0 };
    const next = nextSectionStart(LEVEL1, last);
    expect(next).toEqual({ section: LEVEL1.loopFrom, barInSection: 0, loop: 1 });
  });

  it('la progression d’accords repart à chaque section et cycle sur 4 mesures', () => {
    expect([0, 1, 2, 3, 4, 5].map((b) => chordIndexAt(LEVEL1, b))).toEqual([0, 1, 2, 3, 0, 1]);
  });
});

describe('sectionAtBeat (prévision du director)', () => {
  const intro = { index: 0, name: 'INTRO' as const, intensity: 0.2, bars: 8, loop: 0, beat: 0 };
  const at = (beat: number) => {
    const s = sectionAtBeat(LEVEL1, intro, beat);
    return `${s.name}@${s.beat}/${s.loop}`;
  };

  it('déroule la structure et les rebouclages', () => {
    expect(at(0)).toBe('INTRO@0/0');
    expect(at(31.75)).toBe('INTRO@0/0');
    expect(at(32)).toBe('BUILD@32/0');
    expect(at(64)).toBe('DROP@64/0');
    expect(at(128)).toBe('BREAK@128/0');
    expect(at(160)).toBe('DROP2@160/0');
    expect(at(224)).toBe('BREAK@224/1');
    expect(at(256)).toBe('DROP2@256/1');
  });

  it('un beat passé renvoie la section connue', () => {
    expect(at(-4)).toBe('INTRO@0/0');
  });
});
