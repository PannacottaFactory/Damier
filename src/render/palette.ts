/**
 * Palettes néon. Une par niveau (2–3 couleurs + le rouge du danger).
 * La dérive de teinte en cours de partie viendra à l'étape 8.
 */
export interface Palette {
  bg: string;
  /** Halo radial au centre de l'écran. */
  bgGlow: string;
  grid: string;
  gridFill: string;
  player: string;
  playerGlow: string;
  danger: string;
  text: string;
  textDim: string;
}

export const PALETTE_LEVEL1: Palette = {
  bg: '#05060d',
  bgGlow: '#0e1236',
  grid: '#2de2e6',
  gridFill: 'rgba(45, 226, 230, 0.035)',
  player: '#f4f6ff',
  playerGlow: '#9df9ff',
  danger: '#ff2a4d',
  text: '#e8ecff',
  textDim: 'rgba(232, 236, 255, 0.35)',
};

export const FONT_FAMILY = '"JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace';
