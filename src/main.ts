import { performanceTime } from './core/clock';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { Player } from './game/player';
import { Renderer } from './render/renderer';

/**
 * Point d'entrée — étape 1 : damier + joueur.
 * Câblage minimal : input → logique (player) → rendu, le tout cadencé par une TimeSource.
 */
const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.focus();

const time = performanceTime;
const player = new Player();
const renderer = new Renderer(canvas);

new Input(window, canvas, (action) => {
  // Le temps est lu au moment exact de l'appui, pas à la frame suivante.
  if (action.type === 'move') player.requestMove(action.dir, time.now());
});

startLoop(time, (now) => {
  player.update(now);
  renderer.render({ player: player.view(now) });
});
