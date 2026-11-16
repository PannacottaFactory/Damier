# Projet : PULSE GRID — jeu de rythme et d'esquive façon Super Hexagon

> Cahier des charges d'origine (référence pour toutes les étapes de développement).

## Vision
Un jeu web d'arcade nerveux et minimaliste. Le joueur est un petit carré lumineux sur un damier 5x5. Des cases s'allument en rouge en rythme avec une musique électro intense, et il faut les éviter. Une touche = un hit = game over, puis on relance aussitôt (comme Super Hexagon). L'objectif est de survivre le plus longtemps possible. Le jeu doit donner un sentiment de transe : la musique, les visuels et le gameplay battent ensemble.

## Stack technique
- Vite + TypeScript, sans framework UI
- Rendu en Canvas 2D (plein écran, responsive, adapté au devicePixelRatio)
- Audio avec la Web Audio API brute (pas de bibliothèque si possible)
- Aucun asset externe obligatoire : formes géométriques uniquement, musique générée par le code
- Le jeu doit tourner à 60 fps sur un laptop moyen

## Principe clé : une seule horloge
Tout est piloté par l'horloge audio (`AudioContext.currentTime`), jamais par `setTimeout` ni par le delta de `requestAnimationFrame`.
- Un module `Clock` expose : BPM, beat courant (fractionnaire), mesure, position dans la phrase musicale (4/8/16 temps)
- La musique est séquencée en avance par un scheduler à lookahead (méthode « A Tale of Two Clocks » : on planifie ~100 ms à l'avance)
- Les patterns de danger sont planifiés sur la même grille de temps que les notes : chaque danger tombe exactement sur un temps ou un contretemps
- Un réglage de latence audio (offset en ms) existe dans les options, avec un petit écran de calibration (taper sur le beat)

## Musique : électro procédurale qui décoiffe
Un séquenceur pas-à-pas (16 steps par mesure) synthétise en temps réel :
- Kick : oscillateur sinus avec pitch envelope rapide (150 → 40 Hz) et légère saturation (WaveShaper)
- Snare/clap : bruit blanc filtré, enveloppe courte
- Hi-hats : bruit passe-haut, fermés en doubles croches, ouverts sur les contretemps
- Basse : dent de scie + filtre passe-bas résonant, avec un sidechain simulé (le volume plonge à chaque kick)
- Lead/arpège : square/saw, arpèges sur une progression de 4 accords en mineur
- Effets : delay synchronisé au tempo, compresseur master pour la patate

Structure en sections qui bouclent et montent en intensité :
`INTRO (8 mesures) → BUILD (8, filtre qui s'ouvre, snare roll) → DROP (16) → BREAK (8) → DROP 2 (16, plus dense)…`
Chaque section a un niveau d'intensité qui pilote aussi la difficulté des patterns et l'intensité visuelle.

3 niveaux de difficulté, chacun avec son propre morceau procédural (tonalité, BPM et patterns de batterie différents) :
- NIVEAU 1 : 128 BPM
- NIVEAU 2 : 140 BPM
- NIVEAU 3 : 160 BPM (style hard / drum'n'bass)

## Gameplay

### Déplacement
- Flèches / ZQSD / WASD, une case par appui, déplacement quasi instantané (tween de 60 à 80 ms max pour la lisibilité)
- Buffer d'input : un appui pendant le tween est mémorisé et exécuté juste après
- On ne peut pas sortir du damier (petit « bump » visuel contre le bord)
- Mobile : swipe (secondaire, mais l'architecture doit le permettre)

### Cycle d'un danger (télégraphie équitable)
1. AVERTISSEMENT : la case clignote en contour rouge pulsé, N temps avant l'impact (N dépend de la difficulté : 2 temps en niveau 1, 1 temps en niveau 3)
2. IMPACT : pile sur le beat, la case se remplit d'un rouge vif et éclatant pendant une courte durée (ex. 1/4 de temps). Si le joueur est dessus → mort
3. DISSIPATION : fondu rapide

Règles d'équité, testées automatiquement :
- Un pattern n'est jamais validé s'il n'existe aucun chemin accessible vers une case sûre, compte tenu du nombre de déplacements physiquement possibles pendant la télégraphie (écrire une fonction `isSurvivable(pattern, playerPos, timeAvailable)` avec un BFS)
- Hitbox légèrement indulgente : on est considéré « sur » la case d'arrivée seulement après la moitié du tween

### Bibliothèque de patterns (data-driven)
Les patterns sont décrits en données (fichiers TS), pas codés en dur. Chacun est une séquence d'étapes `{ beatOffset, cells: [x,y][] }`, avec des transformations : rotation 90/180/270, miroir, inversion (cases sûres ↔ dangers).

Patterns à implémenter :
- Lignes / colonnes simples, puis doubles
- Croix, X (diagonales), bordure (tout le contour), centre
- Damier (alterné) puis damier inversé au temps suivant : il faut bouger d'une case à chaque beat
- Balayage : une ligne rouge qui traverse le plateau temps par temps
- Spirale qui se referme vers une case
- « Une seule case sûre » qui se déplace : un pattern À SUIVRE, le joueur doit coller à la case sûre
- Serpent : un chemin sûr qui serpente, tout le reste explose en rythme
- Pluie : cases aléatoires sur les doubles croches (seulement pendant les drops)
- Patterns « call & response » : un pattern montré une fois en avertissement seul, puis rejoué pour de vrai

Un `PatternDirector` choisit les patterns selon la section musicale, l'intensité, et évite de répéter le même pattern deux fois de suite. Les gros patterns tombent sur les débuts de phrase (temps 1 de la mesure 1 sur 4).

### Bonus
Ils apparaissent sur une case (forme géométrique distincte, couleur non rouge), restent quelques temps puis disparaissent :
- Bouclier (hexagone cyan) : absorbe un hit
- Ralenti (losange violet) : baisse le BPM de 15 % pendant 8 temps (musique et jeu ensemble, grâce à l'horloge commune)
- Multiplicateur x2 (étoile jaune) : double le score pendant 16 temps
- Onde de choc (cercle blanc) : annule les dangers en cours d'avertissement

Un bonus n'apparaît jamais sur une case qui sera dangereuse au moment où le joueur pourrait l'atteindre.

### Score et progression
- Chronomètre de survie en gros (secondes + centièmes), comme Super Hexagon
- Score : temps + bonus « near miss » (une case adjacente explose alors qu'on vient de la quitter) + bonus ramassés
- Paliers de rang affichés en cours de partie (LIGNE → TRIANGLE → CARRÉ → PENTAGONE → HEXAGONE), un toutes les 10 secondes
- Meilleurs scores par niveau dans localStorage (dans un try/catch)
- Le niveau 2 se débloque en tenant 60 s au niveau 1, idem pour le niveau 3

## Direction artistique : minimalisme néon
- Fond très sombre, palette réduite par niveau (2 ou 3 couleurs + le rouge du danger), qui dérive lentement en teinte au fil de la partie
- Damier : cases aux bords fins et lumineux, glow via `shadowBlur` ou un buffer offscreen
- Tout pulse avec la musique : le damier « respire » (scale 1.00 → 1.03) sur chaque kick
- Caméra façon Super Hexagon : le plateau tourne lentement, change de sens ou s'incline (perspective légère) aux changements de section. Ça doit rester lisible, jamais au point de désorienter injustement
- Screen shake léger sur les impacts proches et sur les drops
- Particules géométriques (petits triangles/carrés) quand un danger éclate et quand on ramasse un bonus
- Mort : freeze de 150 ms, flash blanc, éclatement du joueur en fragments, coupure de la musique avec un filtre passe-bas, puis « PRESS SPACE » et relance en moins d'une seconde
- Typo : une police monospace ou géométrique (Google Font acceptable si chargée proprement, sinon une police système)
- Menu : les 3 niveaux sous forme de formes géométriques, choix gauche/droite, la musique du niveau survolé joue déjà

## Architecture souhaitée
```
src/
  main.ts
  core/        clock.ts, loop.ts, input.ts, state.ts (machine à états : MENU, PLAYING, DEAD, CALIBRATION)
  audio/       scheduler.ts, synth/ (kick, snare, hat, bass, lead), songs/ (level1.ts…), mixer.ts
  game/        grid.ts, player.ts, hazards.ts, bonuses.ts, collision.ts, score.ts
  patterns/    library/*.ts, transforms.ts, director.ts, survivability.ts
  render/      renderer.ts, camera.ts, effects.ts, particles.ts, ui.ts, palette.ts
  debug/       overlay.ts
```
- Logique de jeu découplée du rendu (le state ne connaît pas le canvas)
- Tests unitaires (Vitest) au minimum pour : survivability, transformations de patterns, conversion temps ↔ beats

## Mode debug (touche F1)
Overlay avec BPM, beat, mesure, section, pattern en cours, FPS, invincibilité (touche I), choix forcé d'un pattern (touches 1 à 9), saut de section (touche N), ralenti x0.5.

## Plan de développement : procède par étapes
Avant de coder, présente-moi ton plan et l'architecture. Ensuite, implémente une étape à la fois, et à la fin de chacune dis-moi quoi tester et attends ma validation :

1. Squelette : Vite + TS, canvas plein écran, damier 5x5, joueur qui se déplace avec buffer d'input
2. Horloge audio + séquenceur + kick/hats seuls. Le damier pulse sur le kick (vérifier la synchro à l'oreille et à l'œil)
3. Musique complète du niveau 1 avec ses sections
4. Système de dangers (avertissement → impact → mort) avec 3 patterns simples + fonction de survivabilité testée
5. Bibliothèque complète de patterns + PatternDirector lié aux sections
6. Mort, relance instantanée, chrono, score, rangs, meilleurs scores
7. Bonus
8. Polish visuel : glow, caméra, particules, shake, palettes
9. Menu, niveaux 2 et 3 avec leurs musiques, déblocages
10. Calibration de latence, contrôles tactiles, équilibrage

## Contraintes de qualité
- Priorité absolue au « game feel » : réactivité de l'input, synchro parfaite, lisibilité des dangers
- Aucune mort ne doit sembler injuste : si un pattern est trop dur, on le corrige plutôt que de rallonger la télégraphie partout
- Le premier son ne démarre qu'après une interaction utilisateur (contrainte des navigateurs)
- Code commenté en français, constantes de gameplay regroupées dans un `config.ts` pour faciliter l'équilibrage

## Ajouts demandés en cours de route
- Bouton pause (Échap / P / bouton à l'écran), pause automatique quand l'onglet est masqué — fait à l'étape 3.
- Rangs : pas de formes géométriques façon Super Hexagon. Remplacés par PULSE → BEAT → GROOVE → RUSH → TRANSE, avec un vumètre comme icône (étape 6).
- Avertissement des dangers : pas de clignotement ; un carré qui se remplit depuis le centre jusqu'à l'impact. Une case n'est jamais frappée plus de 2 fois par pattern (étape 5).
- Statistiques de mort par pattern (panneau F2) pour repérer les patterns trop durs (étape 6).
- Équité : `isSurvivable` simule un joueur humain (réaction, cadence, imprécision de timing, sans connaissance des avertissements pas encore affichés), plus exigeant dans les sections calmes (étape 6).
