import { rep, type Song } from './types';

/**
 * Niveau 1 — « NEON PULSE » · 128 BPM · La mineur.
 * Progression i – VI – III – VII (Am – F – C – G), un accord par mesure :
 * le cycle de 4 mesures colle aux phrases de 4 mesures du gameplay.
 */

const FOUR = 'X...X...X...X...';
const CLAP = '....X.......X...';

export const LEVEL1: Song = {
  name: 'NIVEAU 1',
  bpm: 128,
  bassRoot: 33, // La1 (55 Hz)
  leadRoot: 57, // La3
  progression: [
    { root: 0, tones: [0, 3, 7] }, //  Am
    { root: -4, tones: [0, 4, 7] }, // F
    { root: 3, tones: [0, 4, 7] }, //  C
    { root: -2, tones: [0, 4, 7] }, // G
  ],
  barsPerChord: 1,
  loopFrom: 3, // après DROP2 : BREAK → DROP2 → BREAK…
  sections: [
    {
      // Kick + arpège étouffé ; les hats arrivent à mi-section.
      name: 'INTRO',
      bars: 8,
      intensity: 0.2,
      kick: FOUR,
      hatClosed: [...rep(4, '..x...x...x...x.'), ...rep(4, 'xxXxxxXxxxXxxxXx')],
      arp: '0.2.3.2.4.2.3.2.',
      musicFilter: { from: 600, to: 1400 },
    },
    {
      // Montée : le filtre s'ouvre, roll de snare qui accélère, riser, silence avant le drop.
      name: 'BUILD',
      bars: 8,
      intensity: 0.4,
      kick: [...rep(7, FOUR), 'X...X...X.......'],
      hatClosed: 'xx.xxx.xxx.xxx.x',
      hatOpen: '..X...X...X...X.',
      snare: [
        ...rep(2, 'X...X...X...X...'),
        ...rep(2, 'X.X.X.X.X.X.X.X.'),
        ...rep(3, 'XXXXXXXXXXXXXXXX'),
        'XXXXXXXXXXXX....',
      ],
      snareCrescendoFromBar: 0,
      bass: '..x...x...x...x.',
      arp: '0234324502343245',
      musicFilter: { from: 400, to: 16000 },
      riserFromBar: 0,
    },
    {
      name: 'DROP',
      bars: 16,
      intensity: 0.8,
      crash: true,
      kick: FOUR,
      snare: CLAP,
      hatClosed: 'xx.xxx.xxx.xxx.x',
      hatOpen: '..X...X...X...X.',
      bass: '.xxx.xxx.xxx.xxo',
      arp: '0234324502343245',
    },
    {
      // Respiration : plus de kick, arpège lent noyé dans le delay, puis re-montée.
      name: 'BREAK',
      bars: 8,
      intensity: 0.3,
      hatClosed: [...rep(6, 'x.......x.......'), ...rep(2, 'x.x.x.x.x.x.x.x.')],
      snare: [...rep(6, '................'), 'X.X.X.X.X.X.X.X.', 'XXXXXXXXXXXX....'],
      snareCrescendoFromBar: 6,
      bass: 'x---------------',
      arp: '3...5...4...2...',
      musicFilter: { from: 1200, to: 6000 },
      riserFromBar: 4,
    },
    {
      // Plus dense : kick doublé en fin de mesure, hats en doubles croches, basse qui saute d'octave.
      name: 'DROP2',
      bars: 16,
      intensity: 1,
      crash: true,
      kick: 'X...X...X...X.x.',
      snare: '....X.......X..x',
      hatClosed: 'xXxxxXxxxXxxxXxx',
      hatOpen: '..X...X...X...X.',
      bass: '.xxo.xxo.xxf.xox',
      arp: '0354035403540365',
    },
  ],
};
