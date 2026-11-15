/**
 * Constantes de gameplay regroupées ici pour faciliter l'équilibrage.
 * Toutes les durées « humaines » sont en millisecondes ; le code les convertit en secondes
 * (unité de l'horloge du jeu) au moment de les utiliser.
 */

/** Taille du damier (cases par côté). */
export const GRID_SIZE = 5;

// ─── Déplacement du joueur ──────────────────────────────────────────────────

/** Durée du tween de déplacement. 60–80 ms max : assez pour être lisible, assez court pour être nerveux. */
export const MOVE_TWEEN_MS = 70;

/**
 * Fraction du tween à partir de laquelle le joueur est considéré « sur » la case d'arrivée.
 * 0.5 = hitbox indulgente : on peut quitter une case qui explose jusqu'à mi-chemin.
 */
export const HITBOX_SWITCH_RATIO = 0.5;

/** Nombre d'appuis mémorisés pendant un tween (au-delà, ils sont ignorés). */
export const INPUT_BUFFER_SIZE = 2;

/** Durée du « bump » quand on tape contre le bord du damier. */
export const BUMP_MS = 110;

/** Amplitude du bump, en fraction de case. */
export const BUMP_DISTANCE = 0.14;

// ─── Tactile ────────────────────────────────────────────────────────────────

/** Distance minimale (px CSS) pour qu'un glissement compte comme un swipe. */
export const SWIPE_MIN_PX = 24;

// ─── Rendu ──────────────────────────────────────────────────────────────────

/** Taille du damier en fraction du plus petit côté de l'écran. */
export const BOARD_SCREEN_RATIO = 0.62;

/** Plafond du devicePixelRatio (au-delà, coût GPU élevé pour un gain invisible). */
export const MAX_DPR = 2;
