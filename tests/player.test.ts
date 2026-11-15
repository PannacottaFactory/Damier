import { describe, expect, it } from 'vitest';
import { GRID_SIZE, INPUT_BUFFER_SIZE, MOVE_TWEEN_MS } from '../src/config';
import { Player } from '../src/game/player';

const T = MOVE_TWEEN_MS / 1000;

describe('Player', () => {
  it('se déplace d’une case par appui', () => {
    const p = new Player({ x: 2, y: 2 });
    p.requestMove('right', 0);
    p.update(T);
    expect(p.logicalCell(T)).toEqual({ x: 3, y: 2 });
  });

  it('ne sort pas du damier (bump)', () => {
    const edge = GRID_SIZE - 1;
    const p = new Player({ x: edge, y: 0 });
    p.requestMove('right', 0);
    p.requestMove('up', 0.001);
    expect(p.targetCell()).toEqual({ x: edge, y: 0 });
    expect(p.view(0.01).bumpDir).toBe('up');
  });

  it('hitbox indulgente : bascule sur la case d’arrivée à mi-tween', () => {
    const p = new Player({ x: 2, y: 2 });
    p.requestMove('down', 0);
    expect(p.logicalCell(T * 0.49)).toEqual({ x: 2, y: 2 });
    expect(p.logicalCell(T * 0.5)).toEqual({ x: 2, y: 3 });
  });

  it('mémorise un appui pendant le tween et l’exécute pile à la fin', () => {
    const p = new Player({ x: 0, y: 0 });
    p.requestMove('right', 0);
    p.requestMove('down', T * 0.3); // pendant le tween → bufferisé
    expect(p.targetCell()).toEqual({ x: 1, y: 0 });
    // Frame tardive : le 2e déplacement a démarré à t = T, pas à la frame.
    p.update(T * 1.5);
    expect(p.targetCell()).toEqual({ x: 1, y: 1 });
    expect(p.progress(T * 1.5)).toBeCloseTo(0.5);
  });

  it('enchaîne plusieurs appuis bufferisés même si une frame saute', () => {
    const p = new Player({ x: 0, y: 0 });
    p.requestMove('right', 0);
    p.requestMove('right', 0.01);
    p.requestMove('right', 0.02);
    p.update(T * 10);
    expect(p.targetCell()).toEqual({ x: 1 + INPUT_BUFFER_SIZE, y: 0 });
  });

  it('ignore les appuis au-delà de la taille du buffer', () => {
    const p = new Player({ x: 0, y: 0 });
    p.requestMove('right', 0);
    for (let i = 0; i < INPUT_BUFFER_SIZE + 3; i++) p.requestMove('right', 0.001 * (i + 1));
    p.update(T * 20);
    expect(p.targetCell().x).toBe(1 + INPUT_BUFFER_SIZE);
  });
});
