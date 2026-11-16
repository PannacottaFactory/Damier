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

// ─── Équité (joueur humain simulé par isSurvivable) ─────────────────────────
// Deux profils, interpolés selon la difficulté de la section : « EASY » = joueur posé
// (seuls les patterns confortables passent), « HARD » = joueur vif (drops).

/** Délai entre l'apparition d'un avertissement et le premier déplacement en réponse. */
export const HUMAN_REACTION_MS_EASY = 380;
export const HUMAN_REACTION_MS_HARD = 270;

/** Temps entre deux déplacements enchaînés (appui + tween + décision). */
export const HUMAN_MOVE_MS_EASY = 230;
export const HUMAN_MOVE_MS_HARD = 170;

/** Imprécision de timing : on n'exige jamais de passer dans un trou plus serré que ça autour d'un impact. */
export const HUMAN_TIMING_MS_EASY = 90;
export const HUMAN_TIMING_MS_HARD = 60;

// ─── Director ───────────────────────────────────────────────────────────────

/** Mesures de répit après un (re)départ avant le premier pattern. */
export const FIRST_PATTERN_DELAY_BARS = 1;

/**
 * On engage un pattern juste avant le début de son avertissement (environ une frame) :
 * il est validé depuis la position du joueur au moment où il le voit apparaître.
 */
export const COMMIT_AHEAD_BEATS = 0.06;

/** Une phrase musicale = 4 mesures. */
export const BARS_PER_PHRASE = 4;

/** Difficulté ajoutée à chaque rebouclage du morceau (BREAK → DROP2 → BREAK…). */
export const LOOP_DIFFICULTY_BONUS = 0.1;

/** Silence après un pattern, en temps : long quand c'est calme, quasi nul au maximum de l'intensité. */
export const REST_BEATS_EASY = 3.5;
export const REST_BEATS_HARD = 0.5;

/**
 * Grille des créneaux selon la difficulté : un pattern peut démarrer sur chaque temps (difficulté
 * ≥ GRID_1_BEAT_DIFFICULTY), chaque demi-mesure (≥ GRID_2_BEATS_DIFFICULTY), sinon chaque mesure.
 */
export const GRID_2_BEATS_DIFFICULTY = 0.4;
export const GRID_1_BEAT_DIFFICULTY = 0.9;

/**
 * Probabilité de jouer un gros pattern (en plusieurs temps) sur un début de mesure,
 * interpolée selon la difficulté. Sur un début de phrase elle est plus forte, et le premier
 * temps d'un drop en reçoit toujours un.
 */
export const BIG_PATTERN_CHANCE_EASY = 0.25;
export const BIG_PATTERN_CHANCE_HARD = 0.6;
export const BIG_PATTERN_PHRASE_BONUS = 0.3;

// ─── Mort et relance ────────────────────────────────────────────────────────

/** Gel de l'image au moment de la mort (l'impact « s'imprime »). */
export const DEATH_FREEZE_MS = 150;

/** Durée du flash blanc de la mort. */
export const DEATH_FLASH_MS = 260;

/** Délai avant qu'Espace puisse relancer (évite de relancer sans avoir vu ce qui nous a tués). */
export const RESTART_LOCK_MS = 250;

/** Fréquence du passe-bas master à la mort (la musique est « étouffée »). */
export const DEATH_MUFFLE_HZ = 380;

// ─── Score et progression ───────────────────────────────────────────────────

/** Points par seconde de survie. */
export const SCORE_PER_SECOND = 100;

/** Bonus « near miss » : une case explose alors qu'on vient de la quitter. */
export const NEAR_MISS_POINTS = 250;

/** On a « frôlé » une case si on l'occupait encore il y a moins de ça au moment de son impact. */
export const NEAR_MISS_WINDOW_MS = 250;

/**
 * Rangs affichés en cours de partie, un nouveau toutes les RANK_INTERVAL_S secondes.
 * Thème musical : on monte en intensité jusqu'à la transe (icône : un vumètre qui s'allume).
 */
export const RANKS = ['PULSE', 'BEAT', 'GROOVE', 'RUSH', 'TRANSE'] as const;
export const RANK_INTERVAL_S = 10;

/** Le niveau suivant se débloque en tenant ce temps au niveau précédent. */
export const UNLOCK_SECONDS = 60;

// ─── Rendu ──────────────────────────────────────────────────────────────────

/** Le damier « respire » sur chaque kick : échelle 1 → 1 + PULSE_SCALE. */
export const PULSE_SCALE = 0.03;

/** Constante de décroissance de la pulsation du kick. */
export const PULSE_DECAY_MS = 140;

/** Taille du damier en fraction du plus petit côté de l'écran. */
export const BOARD_SCREEN_RATIO = 0.62;

/** Plafond du devicePixelRatio (au-delà, coût GPU élevé pour un gain invisible). */
export const MAX_DPR = 2;
