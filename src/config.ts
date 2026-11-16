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

// ─── Temps musical ──────────────────────────────────────────────────────────

/** Doubles croches par temps (le séquenceur a 16 steps par mesure). */
export const STEPS_PER_BEAT = 4;
export const BEATS_PER_BAR = 4;

/** Horizon de planification audio (« A Tale of Two Clocks »). */
export const SCHEDULE_AHEAD_MS = 100;

/** Période du tick de planification (Web Worker, insensible au throttling des onglets). */
export const SCHEDULER_TICK_MS = 25;

/** Un step plus en retard que ça (onglet suspendu…) est sauté plutôt que joué en vrac. */
export const LATE_STEP_TOLERANCE_MS = 20;

/** Délai entre le démarrage de l'audio et le premier temps (laisse le scheduler prendre de l'avance). */
export const AUDIO_START_DELAY_MS = 150;

/** Compensation de latence audio choisie par l'utilisateur (réglée par la calibration à l'étape 10). */
export const DEFAULT_LATENCY_OFFSET_MS = 0;

// ─── Dangers ────────────────────────────────────────────────────────────────

/** Télégraphie : durée de l'avertissement avant l'impact, en temps (niveau 1 ; par niveau à l'étape 9). */
export const WARN_BEATS = 2;

/** Durée de l'impact (case mortelle), en temps. */
export const IMPACT_BEATS = 0.25;

/** Durée du fondu après l'impact (purement visuel, inoffensif). */
export const FADE_BEATS = 0.5;

// ─── Équité (modèle du joueur humain utilisé par isSurvivable) ──────────────

/** Temps de réaction : délai entre l'apparition d'un avertissement et le premier déplacement possible. */
export const REACTION_MS = 180;

/** Coût d'un déplacement pour un humain qui enchaîne (appui + tween), en ms. */
export const MOVE_COST_MS = 130;

// ─── Director (provisoire, enrichi à l'étape 5) ─────────────────────────────

/** Mesures de répit après un (re)départ avant le premier pattern. */
export const FIRST_PATTERN_DELAY_BARS = 2;

/** On engage un pattern un peu avant le début de son avertissement, pour qu'il s'affiche pile à temps. */
export const COMMIT_AHEAD_BEATS = 0.25;

// ─── Rendu ──────────────────────────────────────────────────────────────────

/** Le damier « respire » sur chaque kick : échelle 1 → 1 + PULSE_SCALE. */
export const PULSE_SCALE = 0.03;

/** Constante de décroissance de la pulsation du kick. */
export const PULSE_DECAY_MS = 140;

/** Taille du damier en fraction du plus petit côté de l'écran. */
export const BOARD_SCREEN_RATIO = 0.62;

/** Plafond du devicePixelRatio (au-delà, coût GPU élevé pour un gain invisible). */
export const MAX_DPR = 2;
