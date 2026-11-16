import type { BeatTime } from '../patterns/director';
import { type Cell, cellIndex } from './grid';
import type { Hazard, HazardField } from './hazards';
import type { Player } from './player';

/** Petite avance pour ne pas tomber du mauvais côté de la frontière d'un impact (erreur flottante). */
const BEAT_EPS = 1e-6;

export interface Hit {
  time: number;
  cell: Cell;
  /** Dangers qui ont touché le joueur (pour les statistiques par pattern). */
  hazards: Hazard[];
}

/**
 * Le joueur a-t-il été touché entre deux frames ?
 *
 * On ne teste pas seulement « maintenant » : on teste aussi l'instant exact du début
 * de chaque impact survenu depuis la frame précédente, avec la case qu'occupait le joueur
 * à cet instant-là. Le verdict ne dépend donc pas du framerate.
 */
export function findHit(
  player: Player,
  hazards: HazardField,
  tempo: BeatTime,
  fromBeat: number,
  toBeat: number,
  now: number,
): Hit | null {
  const samples = hazards.impactStartsBetween(fromBeat, toBeat).map((b) => tempo.timeAt(b));
  samples.push(now);
  for (const t of samples) {
    const cell = player.cellAt(t);
    const killers = hazards.lethalFor(cellIndex(cell), tempo.beatAt(t) + BEAT_EPS);
    if (killers.length > 0) return { time: t, cell, hazards: killers };
  }
  return null;
}
