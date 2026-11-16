import type { PatternDef } from '../types';
import { COMETS, FALLING, MOVING_BLOCK, MOVING_CROSS, TRAIN } from './moving';
import { FOLLOW, RAIN, SNAKE } from './random';
import { CALL_RESPONSE, CHECKER, DIAGONAL_SWEEP, PINCER, QUADRANTS, RINGS, SPIRAL, STRIPES, SWEEP } from './sequences';
import { BORDER, CENTER_BLOCK, CROSS, DOUBLE_LINE, LINE, SAFE_LINE, X_SHAPE } from './simple';

/**
 * Bibliothèque complète. L'ordre sert aussi aux touches de debug
 * (pages de 10 familles : 1–9, 0 dans la page, Page préc./suiv. pour changer de page).
 */
export const LIBRARY: readonly PatternDef[] = [
  LINE,
  DOUBLE_LINE,
  CROSS,
  X_SHAPE,
  BORDER,
  CENTER_BLOCK,
  SAFE_LINE,
  STRIPES,
  CHECKER,
  SWEEP,
  DIAGONAL_SWEEP,
  PINCER,
  QUADRANTS,
  RINGS,
  SPIRAL,
  FOLLOW,
  SNAKE,
  RAIN,
  CALL_RESPONSE,
  MOVING_BLOCK,
  MOVING_CROSS,
  TRAIN,
  COMETS,
  FALLING,
];
