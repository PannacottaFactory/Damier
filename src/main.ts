import { AudioEngine } from './audio/engine';
import { LEVEL1 } from './audio/songs/level1';
import { playImpact } from './audio/synth/impact';
import { DEATH_FREEZE_MS, PULSE_DECAY_MS, STEPS_PER_BEAT } from './config';
import { musicalPosition } from './core/clock';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { createRng } from './core/random';
import { browserStore } from './core/storage';
import { PatternStats } from './game/patternStats';
import { Records, type SubmitResult } from './game/records';
import { rankIndex, timeSinceRankUp } from './game/score';
import { DebugOverlay } from './debug/overlay';
import { GameSession } from './game/session';
import { PauseButton } from './render/pauseButton';
import { Renderer } from './render/renderer';

/**
 * Point d'entrée — étape 6 : mort (gel, flash, éclatement, musique étouffée), relance instantanée,
 * chrono, score, rangs, meilleurs scores, statistiques de mort par pattern.
 * Tout le jeu lit le temps sur `clock` (temps audio perçu), jamais ailleurs.
 */
const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.focus();

/** Niveau joué (le menu de choix arrive à l'étape 9). */
const LEVEL = 1;

const audio = new AudioEngine(LEVEL1);
const clock = audio.clock;
// Prévision de section (tient compte d'une relance du morceau en attente).
const session = new GameSession(clock.tempo, createRng(Date.now()), (beat) => audio.sectionAt(beat));
const records = new Records(browserStore);
const patternStats = new PatternStats(browserStore);
/** Résultat de la dernière partie (records battus ?), pour l'écran de mort. */
let lastResult: SubmitResult | null = null;
const renderer = new Renderer(canvas);
const debug = new DebugOverlay();
/** F2 : statistiques de mort par pattern (outil d'équilibrage). */
const statsPanel = new DebugOverlay('right');

// Son d'impact : déclenché par le scheduler audio, pile sur la double croche de l'impact.
audio.scheduler.onStep((step, time) => {
  if (session.state !== 'PLAYING') return;
  const n = session.hazards.impactsAt(step / STEPS_PER_BEAT);
  if (n > 0) playImpact(audio.ctx, audio.mixer.drums, time, Math.min(1.3, 0.8 + 0.2 * n));
});

// ─── Pause ───
function setPaused(paused: boolean): void {
  // Ignoré tant que l'audio n'a pas fini de démarrer (ex. Échap comme toute première touche).
  if (!audio.isPaused && !audio.isRunning) return;
  void audio.setPaused(paused);
  pauseButton.set(paused);
}
/** Debug : page de familles affichée pour les touches 1–9, 0. */
let debugPage = 0;
const pauseButton = new PauseButton(() => setPaused(!audio.isPaused));
// Onglet masqué → pause automatique (on ne veut pas mourir pendant qu'on regarde ailleurs).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});

// Premier geste utilisateur → démarrage de l'audio (obligatoire avant tout son) puis de la partie.
const unlock = () =>
  void audio.start().then(() => {
    pauseButton.show();
    session.restart(clock.now());
  });

/** Relance immédiate : nouvelle partie, le morceau repart de l'intro à la mesure suivante. */
function restart(): void {
  if (!audio.isRunning || !session.canRestart(clock.now())) return;
  session.restart(clock.now());
  audio.restartSong();
  audio.mixer.muffle(false, audio.ctx.currentTime);
  lastResult = null;
}
// Mobile : un tap n'importe où relance.
canvas.addEventListener('pointerdown', () => {
  if (session.state === 'DEAD') restart();
});
window.addEventListener('keydown', unlock, { capture: true, once: true });
window.addEventListener('pointerdown', unlock, { capture: true, once: true });

new Input(window, canvas, (action) => {
  if (action.type === 'key') {
    if (action.code === 'F1') debug.toggle();
    else if (action.code === 'F2') statsPanel.toggle();
    else if (action.code === 'Escape' || action.code === 'KeyP') setPaused(!audio.isPaused);
    else if (action.code === 'Space') restart();
    // Commandes de triche : actives seulement quand l'overlay est affiché.
    else if (debug.isVisible && action.code === 'KeyN') audio.sequencer.requestSkip();
    else if (debug.isVisible && action.code === 'KeyI') session.invincible = !session.invincible;
    else if (statsPanel.isVisible && action.code === 'Delete') patternStats.reset();
    else if (debug.isVisible && (action.code === 'PageDown' || action.code === 'PageUp')) {
      const pages = Math.ceil(session.director.families.length / 10);
      debugPage = (debugPage + (action.code === 'PageDown' ? 1 : pages - 1)) % pages;
    } else if (debug.isVisible && /^Digit\d$/.test(action.code)) {
      // 1–9, 0 → familles 1 à 10 de la page affichée.
      const digit = Number(action.code.slice(5));
      const family = session.director.families[debugPage * 10 + (digit === 0 ? 9 : digit - 1)];
      if (family) session.director.force(family);
    }
    return;
  }
  // Pas de déplacement tant que l'horloge audio ne tourne pas (le premier appui sert à lancer le son).
  if (!audio.isRunning) return;
  // Le temps est lu au moment exact de l'appui, pas à la frame suivante.
  session.move(action.dir, clock.now());
});

startLoop(clock, () => {
  audio.frame();
  const now = clock.now();
  const beat = clock.tempo.beatAt(now);
  const section = audio.timeline.sectionAt(now);
  if (session.state !== 'MENU') session.update(now);

  for (const e of session.drainEvents()) {
    if (e.type === 'patternSurvived') patternStats.survived(e.family);
    else if (e.type === 'death') {
      patternStats.died(e.killers);
      lastResult = records.submit(LEVEL, e.survived, e.score);
      audio.mixer.muffle(true, audio.ctx.currentTime);
    }
  }

  // Pulsation : pic au moment où le kick est ENTENDU, puis décroissance exponentielle.
  // (En pause, `now` est figé : la pulsation se fige avec.)
  const kick = audio.hasStarted ? audio.timeline.last('kick', now) : null;
  const pulse = kick ? kick.velocity * Math.exp(-(now - kick.time) / (PULSE_DECAY_MS / 1000)) : 0;

  const death = session.death;
  // Gel de l'image juste après la mort : l'impact fatal « s'imprime ».
  const shownBeat =
    death && now - death.time < DEATH_FREEZE_MS / 1000 ? clock.tempo.beatAt(death.time) : beat;
  const time = session.survivalTime(now);
  const record = records.get(LEVEL);

  renderer.render({
    player: session.player.view(now),
    pulse: death ? 0 : pulse,
    audioStarted: audio.hasStarted,
    paused: audio.isPaused,
    cells: session.hazards.cellStates(shownBeat),
    invincible: session.invincible,
    hud:
      session.state === 'MENU'
        ? null
        : {
            time,
            score: session.score(now),
            rank: rankIndex(time),
            sinceRankUp: timeSinceRankUp(time),
            bestTime: record.bestTime,
            nearMisses: session.nearMissLog.map((n) => ({ age: now - n.time, cell: n.cell })),
          },
    death: death
      ? {
          elapsed: now - death.time,
          cell: death.cell,
          seed: Math.floor(death.time * 1000),
          survived: death.survived,
          score: death.score,
          rank: rankIndex(death.survived),
          bestTime: record.bestTime,
          bestScore: record.bestScore,
          newBestTime: lastResult?.newBestTime ?? false,
          newBestScore: lastResult?.newBestScore ?? false,
        }
      : null,
  });

  debug.frame(() => {
    const pos = musicalPosition(beat);
    const ctx = audio.ctx;
    const barInSection = section ? Math.floor((pos.beat - section.beat) / 4) + 1 : 0;
    const cell = session.player.targetCell();
    return {
      Audio: ctx.state,
      État: session.state + (session.invincible ? '  (INVINCIBLE)' : ''),
      Section: section ? `${section.name}  ${barInSection}/${section.bars}  (boucle ${section.loop})` : '—',
      Intensité: section ? section.intensity.toFixed(2) : '—',
      BPM: clock.bpm().toFixed(1),
      Beat: pos.beat.toFixed(2),
      'Mesure.temps': `${pos.bar + 1}.${pos.beatInBar + 1}  (step ${pos.stepInBar + 1}/16)`,
      Phrase: `${pos.barInPhrase4 + 1}/4 · ${pos.barInPhrase8 + 1}/8 · ${pos.barInPhrase16 + 1}/16`,
      Pattern: session.lastPatternId ?? '—',
      Forcé: session.director.forcedFamily ?? '—',
      Dangers: session.hazards.all().length,
      Joueur: `(${cell.x}, ${cell.y})`,
      'Latence sortie': `${((ctx.outputLatency || 0) * 1000).toFixed(1)} ms`,
      'Latence base': `${((ctx.baseLatency || 0) * 1000).toFixed(1)} ms`,
      'Offset calib.': `${(clock.latencyOffset * 1000).toFixed(0)} ms`,
      'Avance audio': `${((ctx.currentTime - now) * 1000).toFixed(1)} ms`,
      '': '',
      'Tué par': death ? death.killers.join(', ') : '—',
      'Near misses': session.nearMisses,
      ' ': '',
      Touches: 'F2 : morts par pattern · N : section suivante · I : invincible · 1–9, 0 : forcer · Page préc./suiv. : autres patterns',
      ...Object.fromEntries(
        session.director.families
          .slice(debugPage * 10, debugPage * 10 + 10)
          .map((f, i) => [`  ${(i + 1) % 10}`, f]),
      ),
    };
  });

  statsPanel.frame(() => {
    const rows = patternStats.rows();
    const total = rows.reduce((n, r) => n + r.deaths, 0);
    return {
      'MORTS PAR PATTERN': `${total} morts au total — Suppr : remettre à zéro`,
      Famille: 'morts / joués   taux',
      ...Object.fromEntries(
        rows.map((r) => [
          r.family,
          `${String(r.deaths).padStart(4)} / ${String(r.deaths + r.survived).padEnd(5)} ${String(Math.round(r.rate * 100)).padStart(3)} %`,
        ]),
      ),
    };
  });
});
