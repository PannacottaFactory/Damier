import { describe, expect, it } from 'vitest';
import { LEVEL1 } from '../src/audio/songs/level1';
import {
  arpNote,
  bassNote,
  parseNotes,
  parsePattern,
  type Song,
  type Track,
  trackBar,
} from '../src/audio/songs/types';

describe('parsePattern (batterie)', () => {
  it('convertit la notation en vélocités et ignore les espaces', () => {
    expect(parsePattern('X... x.X.')).toEqual([1, 0, 0, 0, 0.65, 0, 1, 0]);
  });

  it('refuse un caractère inconnu', () => {
    expect(() => parsePattern('X..?')).toThrow();
  });
});

describe('parseNotes (mélodique)', () => {
  it('gère silences, notes et prolongations', () => {
    const n = parseNotes('x--. 0.1-');
    expect(n).toEqual([{ token: 'x', length: 3 }, null, null, null, { token: '0', length: 1 }, null, { token: '1', length: 2 }, null]);
  });

  it('un « - » après un silence ne fait rien', () => {
    expect(parseNotes('.-x')).toEqual([null, null, { token: 'x', length: 1 }]);
  });

  it('refuse un caractère inconnu', () => {
    expect(() => parseNotes('x?')).toThrow();
  });
});

describe('hauteurs', () => {
  const am = { root: 0, tones: [0, 3, 7] };
  const f = { root: -4, tones: [0, 4, 7] };

  it('arpège : index dans les notes de l’accord empilées en octaves', () => {
    expect(arpNote('0', am, 57)).toBe(57);
    expect(arpNote('1', am, 57)).toBe(60);
    expect(arpNote('2', am, 57)).toBe(64);
    expect(arpNote('3', am, 57)).toBe(69);
    expect(arpNote('4', f, 57)).toBe(53 + 12 + 4);
  });

  it('basse : fondamentale, octave, quinte, tierce', () => {
    expect(bassNote('x', f, 33)).toBe(29);
    expect(bassNote('o', f, 33)).toBe(41);
    expect(bassNote('f', am, 33)).toBe(40);
    expect(bassNote('t', am, 33)).toBe(36);
  });
});

describe('trackBar', () => {
  it('une chaîne boucle, un tableau est indexé par mesure (modulo)', () => {
    expect(trackBar('a', 5)).toBe('a');
    expect(trackBar(['a', 'b'], 3)).toBe('b');
    expect(trackBar(undefined, 0)).toBeNull();
  });
});

/** Validation des données d'un morceau : attrape les fautes de frappe dans les pistes. */
function validateSong(song: Song): void {
  expect(song.loopFrom).toBeGreaterThanOrEqual(0);
  expect(song.loopFrom).toBeLessThan(song.sections.length);
  for (const sec of song.sections) {
    expect(sec.bars % 4, `${sec.name} : multiple de 4 mesures`).toBe(0);
    const drums: (Track | undefined)[] = [sec.kick, sec.snare, sec.hatClosed, sec.hatOpen];
    const melodic: (Track | undefined)[] = [sec.bass, sec.arp];
    for (let bar = 0; bar < sec.bars; bar++) {
      for (const t of drums) {
        const src = trackBar(t, bar);
        if (src !== null) expect(parsePattern(src), `${sec.name} mesure ${bar} : « ${src} »`).toHaveLength(16);
      }
      for (const t of melodic) {
        const src = trackBar(t, bar);
        if (src !== null) expect(parseNotes(src), `${sec.name} mesure ${bar} : « ${src} »`).toHaveLength(16);
      }
    }
  }
}

describe('morceaux', () => {
  it('niveau 1 : toutes les pistes sont valides et font 16 steps', () => validateSong(LEVEL1));
});
