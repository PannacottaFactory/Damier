/**
 * Source de temps du jeu, en secondes.
 *
 * Étape 1 : simple horloge `performance.now()` (pas encore d'audio).
 * Étape 2 : remplacée par l'horloge audio (AudioContext.currentTime + table des tempos),
 * qui deviendra l'unique référence pour la musique, les dangers et le rendu.
 */
export interface TimeSource {
  now(): number;
}

export const performanceTime: TimeSource = {
  now: () => performance.now() / 1000,
};
