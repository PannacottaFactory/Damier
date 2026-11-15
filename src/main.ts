import { AudioEngine } from './audio/engine';
import { LEVEL1 } from './audio/songs/level1';
import { PULSE_DECAY_MS } from './config';
import { musicalPosition } from './core/clock';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { DebugOverlay } from './debug/overlay';
import { Player } from './game/player';
import { Renderer } from './render/renderer';

/**
 * Point d'entrée — étape 2 : horloge audio + kick/hats, damier qui pulse sur le kick.
 * Tout le jeu lit le temps sur `clock` (temps audio perçu), jamais ailleurs.
 */
const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.focus();

const audio = new AudioEngine(LEVEL1);
const clock = audio.clock;
const player = new Player();
const renderer = new Renderer(canvas);
const debug = new DebugOverlay();

// Premier geste utilisateur → démarrage de l'audio (obligatoire avant tout son).
const unlock = () => void audio.start();
window.addEventListener('keydown', unlock, { capture: true, once: true });
window.addEventListener('pointerdown', unlock, { capture: true, once: true });

new Input(window, canvas, (action) => {
  if (action.type === 'key') {
    if (action.code === 'F1') debug.toggle();
    return;
  }
  // Pas de déplacement tant que l'horloge audio ne tourne pas (le premier appui sert à lancer le son).
  if (!audio.isRunning) return;
  // Le temps est lu au moment exact de l'appui, pas à la frame suivante.
  player.requestMove(action.dir, clock.now());
});

startLoop(clock, () => {
  audio.frame();
  const now = clock.now();
  player.update(now);

  // Pulsation : pic au moment où le kick est ENTENDU, puis décroissance exponentielle.
  const kick = audio.isRunning ? audio.timeline.last('kick', now) : null;
  const pulse = kick ? kick.velocity * Math.exp(-(now - kick.time) / (PULSE_DECAY_MS / 1000)) : 0;

  renderer.render({ player: player.view(now), pulse, audioStarted: audio.isRunning });

  debug.frame(() => {
    const pos = musicalPosition(clock.beat());
    const ctx = audio.ctx;
    return {
      Audio: ctx.state,
      BPM: clock.bpm().toFixed(1),
      Beat: pos.beat.toFixed(2),
      'Mesure.temps': `${pos.bar + 1}.${pos.beatInBar + 1}  (step ${pos.stepInBar + 1}/16)`,
      Phrase: `${pos.barInPhrase4 + 1}/4 · ${pos.barInPhrase8 + 1}/8 · ${pos.barInPhrase16 + 1}/16`,
      'Latence sortie': `${((ctx.outputLatency || 0) * 1000).toFixed(1)} ms`,
      'Latence base': `${((ctx.baseLatency || 0) * 1000).toFixed(1)} ms`,
      'Offset calib.': `${(clock.latencyOffset * 1000).toFixed(0)} ms`,
      'Avance audio': `${((ctx.currentTime - now) * 1000).toFixed(1)} ms`,
    };
  });
});
