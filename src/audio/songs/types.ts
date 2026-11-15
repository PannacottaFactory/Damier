/**
 * Format des morceaux (enrichi à l'étape 3 : sections, basse, lead, automation).
 *
 * Notation des patterns, 16 caractères = 1 mesure (espaces ignorés) :
 *   '.' silence · 'x' coup normal · 'X' accent
 */
export interface DrumPatterns {
  kick: string;
  hatClosed: string;
  hatOpen: string;
}

export interface Song {
  name: string;
  bpm: number;
  drums: DrumPatterns;
}

/** Vélocité par caractère. */
const VELOCITY: Record<string, number> = { '.': 0, x: 0.65, X: 1 };

/** Convertit une chaîne de pattern en tableau de vélocités (0 = silence). */
export function parsePattern(src: string): number[] {
  const chars = src.replace(/\s+/g, '');
  return [...chars].map((c) => {
    const v = VELOCITY[c];
    if (v === undefined) throw new Error(`Caractère de pattern inconnu : « ${c} » dans « ${src} »`);
    return v;
  });
}
