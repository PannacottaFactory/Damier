import { describe, expect, it } from 'vitest';
import { advanceBar, chordIndexAt, nextSectionStart, SONG_START, sectionOf } from '../src/audio/arrangement';
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
