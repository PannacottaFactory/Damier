import { describe, expect, it } from 'vitest';
import { LEVEL1 } from '../src/audio/songs/level1';
import { parsePattern } from '../src/audio/songs/types';

describe('parsePattern', () => {
  it('convertit la notation en vélocités et ignore les espaces', () => {
    expect(parsePattern('X... x.X.')).toEqual([1, 0, 0, 0, 0.65, 0, 1, 0]);
  });

  it('refuse un caractère inconnu', () => {
    expect(() => parsePattern('X..?')).toThrow();
  });

  it('les patterns du niveau 1 font exactement 16 steps', () => {
    for (const p of Object.values(LEVEL1.drums)) expect(parsePattern(p)).toHaveLength(16);
  });
});
