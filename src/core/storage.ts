/**
 * Accès à localStorage protégé : navigation privée, quota plein ou stockage bloqué
 * ne doivent jamais faire planter le jeu. En cas d'échec, on joue sans sauvegarde.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const browserStore: KeyValueStore = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* stockage indisponible : on continue sans sauvegarde */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* idem */
    }
  },
};

/** Stockage en mémoire (tests). */
export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
}

/** Lit un JSON ; renvoie `fallback` si absent ou corrompu. */
export function readJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  const raw = store.get(key);
  if (raw === null) return fallback;
  try {
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  store.set(key, JSON.stringify(value));
}
