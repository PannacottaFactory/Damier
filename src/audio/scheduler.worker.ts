/**
 * Métronome de planification, dans un Worker : les timers d'un Worker ne sont pas
 * bridés comme ceux de la page quand l'onglet passe en arrière-plan.
 * Il ne fait QUE réveiller le scheduler ; le temps de référence reste l'AudioContext.
 */
const scope = self as unknown as {
  postMessage(message: unknown): void;
  onmessage: ((e: MessageEvent<{ cmd: 'start' | 'stop'; interval?: number }>) => void) | null;
};

let timer: ReturnType<typeof setInterval> | undefined;

scope.onmessage = (e) => {
  clearInterval(timer);
  timer = undefined;
  if (e.data.cmd === 'start') {
    timer = setInterval(() => scope.postMessage('tick'), e.data.interval ?? 25);
  }
};
