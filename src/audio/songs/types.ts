/**
 * Format des morceaux procéduraux : tout est décrit en données.
 *
 * ─── Notation des pistes (16 caractères = 1 mesure, espaces ignorés) ───────
 *
 * Batterie :  '.' silence · 'x' coup normal · 'X' accent
 *
 * Mélodique (basse, arpège) :
 *   '.' silence · '-' prolonge la note précédente d'une double croche
 *   Basse   : 'x' fondamentale · 'o' octave · 'f' quinte · 't' tierce de l'accord
 *   Arpège  : '0'…'9' = index dans les notes de l'accord empilées en octaves
 *             (0 = fondamentale, 1 = tierce, 2 = quinte, 3 = fondamentale +1 oct…)
 *
 * Une piste est soit une mesure qui boucle, soit un tableau de mesures
 * (indexé par la mesure dans la section, modulo sa longueur).
 */
export type Track = string | readonly string[];

export type SectionName = 'INTRO' | 'BUILD' | 'DROP' | 'BREAK' | 'DROP2';

export interface Section {
  name: SectionName;
  /** Durée en mesures (multiple de 4 pour respecter les phrases). */
  bars: number;
  /** 0..1 : pilote aussi la difficulté des patterns et l'intensité visuelle. */
  intensity: number;
  kick?: Track;
  snare?: Track;
  hatClosed?: Track;
  hatOpen?: Track;
  bass?: Track;
  arp?: Track;
  /** Filtre passe-bas de la musique (basse + lead), interpolé sur la section. Absent = ouvert. */
  musicFilter?: { from: number; to: number };
  /** Montée de bruit (riser) à partir de cette mesure, jusqu'à la fin de la section. */
  riserFromBar?: number;
  /** Crescendo du snare (roll) à partir de cette mesure. */
  snareCrescendoFromBar?: number;
  /** Crash sur le premier temps de la section (impact des drops). */
  crash?: boolean;
}

export interface Chord {
  /** Fondamentale, en demi-tons relatifs à la tonique. */
  root: number;
  /** Intervalles de l'accord depuis sa fondamentale (ex. mineur [0, 3, 7]). */
  tones: readonly number[];
}

export interface Song {
  name: string;
  bpm: number;
  /** Note MIDI de la tonique pour la basse et pour le lead. */
  bassRoot: number;
  leadRoot: number;
  /** Progression d'accords, qui repart au début de chaque section. */
  progression: readonly Chord[];
  barsPerChord: number;
  sections: readonly Section[];
  /** Index de la section où l'on reboucle après la dernière. */
  loopFrom: number;
}

// ─── Parsing ────────────────────────────────────────────────────────────────

/** Vélocité par caractère de batterie. */
const VELOCITY: Record<string, number> = { '.': 0, x: 0.65, X: 1 };

/** Convertit une mesure de batterie en tableau de vélocités (0 = silence). */
export function parsePattern(src: string): number[] {
  const chars = src.replace(/\s+/g, '');
  return [...chars].map((c) => {
    const v = VELOCITY[c];
    if (v === undefined) throw new Error(`Caractère de batterie inconnu : « ${c} » dans « ${src} »`);
    return v;
  });
}

/** Note d'une piste mélodique : symbole + durée en doubles croches. */
export interface NoteEvent {
  token: string;
  length: number;
}

const MELODIC_TOKEN = /^[0-9xoft]$/;

/**
 * Convertit une mesure mélodique en tableau (1 case par double croche) :
 * la case de départ d'une note contient l'événement, les autres sont null.
 */
export function parseNotes(src: string): (NoteEvent | null)[] {
  const chars = [...src.replace(/\s+/g, '')];
  const out: (NoteEvent | null)[] = chars.map(() => null);
  let current: NoteEvent | null = null;
  chars.forEach((c, i) => {
    if (c === '.') current = null;
    else if (c === '-') {
      if (current) current.length++;
    } else if (MELODIC_TOKEN.test(c)) {
      current = { token: c, length: 1 };
      out[i] = current;
    } else {
      throw new Error(`Caractère mélodique inconnu : « ${c} » dans « ${src} »`);
    }
  });
  return out;
}

/** Mesure de la piste à jouer pour une mesure donnée de la section. */
export function trackBar(track: Track | undefined, barInSection: number): string | null {
  if (track === undefined) return null;
  if (typeof track === 'string') return track;
  return track.length === 0 ? null : track[barInSection % track.length];
}

/** Répète une mesure n fois (pratique pour écrire les pistes par blocs). */
export function rep(n: number, bar: string): string[] {
  return Array.from({ length: n }, () => bar);
}

/** Hauteur MIDI d'un symbole d'arpège ('0'…'9') sur un accord. */
export function arpNote(token: string, chord: Chord, root: number): number {
  const d = Number(token);
  const n = chord.tones.length;
  return root + chord.root + chord.tones[d % n] + 12 * Math.floor(d / n);
}

/** Hauteur MIDI d'un symbole de basse ('x', 'o', 'f', 't') sur un accord. */
export function bassNote(token: string, chord: Chord, root: number): number {
  const base = root + chord.root;
  switch (token) {
    case 'o':
      return base + 12;
    case 'f':
      return base + 7;
    case 't':
      return base + (chord.tones[1] ?? 3);
    default:
      return base;
  }
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
