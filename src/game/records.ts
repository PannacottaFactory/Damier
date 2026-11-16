import { UNLOCK_SECONDS } from '../config';
import { type KeyValueStore, readJson, writeJson } from '../core/storage';

/**
 * Meilleurs scores par niveau, persistés via un KeyValueStore protégé (localStorage).
 * Le meilleur temps sert aussi au déblocage des niveaux.
 */
export interface LevelRecord {
  bestTime: number;
  bestScore: number;
  runs: number;
}

export interface SubmitResult {
  newBestTime: boolean;
  newBestScore: boolean;
  /** Record d'avant cette partie. */
  previous: LevelRecord;
}

const KEY = 'pulsegrid.records.v1';
const EMPTY: LevelRecord = { bestTime: 0, bestScore: 0, runs: 0 };

export class Records {
  private data: Record<string, LevelRecord> = {};

  constructor(private readonly store: KeyValueStore) {
    const raw = readJson<Record<string, Partial<LevelRecord>>>(store, KEY, {});
    // Données éventuellement corrompues : on ne garde que des nombres valides.
    if (raw && typeof raw === 'object') {
      for (const [level, r] of Object.entries(raw)) {
        this.data[level] = { bestTime: num(r?.bestTime), bestScore: num(r?.bestScore), runs: num(r?.runs) };
      }
    }
  }

  get(level: number): LevelRecord {
    return this.data[level] ?? EMPTY;
  }

  submit(level: number, time: number, score: number): SubmitResult {
    const previous = this.get(level);
    this.data[level] = {
      bestTime: Math.max(previous.bestTime, time),
      bestScore: Math.max(previous.bestScore, score),
      runs: previous.runs + 1,
    };
    writeJson(this.store, KEY, this.data);
    return { newBestTime: time > previous.bestTime, newBestScore: score > previous.bestScore, previous };
  }

  /** Le niveau 1 est toujours ouvert ; le niveau N s'ouvre en tenant UNLOCK_SECONDS au niveau N-1. */
  isUnlocked(level: number): boolean {
    return level <= 1 || this.get(level - 1).bestTime >= UNLOCK_SECONDS;
  }
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}
