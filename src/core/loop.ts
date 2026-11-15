import type { TimeSource } from './clock';

/**
 * Boucle de rendu. requestAnimationFrame ne sert qu'à cadencer l'affichage :
 * le temps est toujours relu sur la TimeSource, jamais déduit du delta entre frames.
 * Renvoie une fonction d'arrêt.
 */
export function startLoop(time: TimeSource, frame: (now: number) => void): () => void {
  let handle = 0;
  const tick = () => {
    frame(time.now());
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(handle);
}
