import { type KeyValueStore, readJson, writeJson } from '../core/storage';

/**
 * Statistiques de mort par famille de pattern (outil d'équilibrage, affiché dans le debug).
 * - survived : le pattern est allé au bout sans tuer le joueur ;
 * - deaths : le pattern a tué le joueur.
 * Un pattern interrompu par une mort due à un AUTRE pattern ne compte pas.
 * Persisté pour cumuler les parties.
 */
export interface FamilyStats {
  survived: number;
  deaths: number;
}

export interface StatsRow extends FamilyStats {
  family: string;
  /** Taux de mort : deaths / (deaths + survived). */
  rate: number;
}

// v2 : statistiques remises à zéro avec le nouveau modèle d'équité (joueur humain simulé).
const KEY = 'pulsegrid.patternStats.v2';

export class PatternStats {
  private data: Record<string, FamilyStats>;

  constructor(private readonly store: KeyValueStore) {
    const raw = readJson<Record<string, FamilyStats>>(store, KEY, {});
    this.data = raw && typeof raw === 'object' ? raw : {};
  }

  survived(family: string): void {
    this.entry(family).survived++;
    this.save();
  }

  died(families: readonly string[]): void {
    for (const f of new Set(families)) this.entry(f).deaths++;
    this.save();
  }

  reset(): void {
    this.data = {};
    this.store.remove(KEY);
  }

  /** Familles triées de la plus meurtrière à la plus sûre. */
  rows(): StatsRow[] {
    return Object.entries(this.data)
      .map(([family, s]) => ({ family, ...s, rate: s.deaths / Math.max(1, s.deaths + s.survived) }))
      .sort((a, b) => b.rate - a.rate || b.deaths - a.deaths);
  }

  private entry(family: string): FamilyStats {
    const e = this.data[family];
    if (e && typeof e.survived === 'number' && typeof e.deaths === 'number') return e;
    return (this.data[family] = { survived: 0, deaths: 0 });
  }

  private save(): void {
    writeJson(this.store, KEY, this.data);
  }
}
