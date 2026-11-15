import type { Song } from './types';

/** Niveau 1 — 128 BPM. Étape 2 : batterie seule (kick + hats). */
export const LEVEL1: Song = {
  name: 'NIVEAU 1',
  bpm: 128,
  drums: {
    kick: '     X... X... X... X...',
    hatClosed: 'xx.x xX.x xx.x xX.x',
    hatOpen: '  ..X. ..X. ..X. ..X.',
  },
};
