// Game loop + app wiring. Accumulate real time, run the sim in FIXED steps,
// render with interpolation. Keeps the three concerns separate: controllers
// produce intents, step() evolves state, the renderer draws it.
import { Sfx } from './audio';
import { BotController } from './controllers/bot';
import { HumanController, isThrowContext } from './controllers/human';
import type { Controller } from './controllers/types';
import {
  BALL_GRAB_RANGE, HUMAN_TEAM, PICKUP_RANGE, PLACE_RANGE, ROUND_END_DELAY, TICK,
} from './sim/config';
import { hashSeed } from './sim/rng';
import { createMatch, startNextRound } from './sim/state';
import { step } from './sim/step';
import type { GameState, StoneState } from './sim/types';
import { dist } from './sim/vec';
import { InputManager } from './input/inputManager';
import { paletteForSkin } from './render/palette';
import { Renderer, type InterpSnapshot } from './render/renderer';
import { Menu, type MenuChoice } from './ui/menu';
import { Hud } from './ui/hud';
import { Results } from './ui/results';

const HUMAN_ID = 0;
const WINS_KEY = '7pietre.wins';
// Debug overlay toggle. Visiting `?debug` turns it on and remembers it (handy on
// mobile where retyping the query each time is painful); `?debug=off` clears it.
const DEBUG_KEY = '7pietre.debug';
const debugParam = new URLSearchParams(location.search).get('debug');
if (debugParam !== null) localStorage.setItem(DEBUG_KEY, debugParam === 'off' ? '0' : '1');
const DEBUG = localStorage.getItem(DEBUG_KEY) === '1';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;

const input = new InputManager();
const sfx = new Sfx();

// Backdrop match so the courtyard shows behind the menu.
let choice: MenuChoice | null = null;
let state: GameState = createMatch(0x1234, 'dusk-courtyard');
let controllers: Controller[] = [];
let renderer = new Renderer(canvas, paletteForSkin('dusk-courtyard'), 'dusk-courtyard', HUMAN_ID, DEBUG);

input.attach(canvas, (cx, cy) => renderer.toView(cx, cy));

// --- UI ---
const hud = new Hud();
const menu = new Menu((c) => startMatch(c));
const results = new Results(() => { if (choice) startMatch(choice); }, () => backToMenu());
uiRoot.append(hud.root, hud.banner, hud.prompt, menu.root, results.root);
hud.setPrompt('');
setHudVisible(false);

let highWins = Number(localStorage.getItem(WINS_KEY) || '0') | 0;
menu.setHighScore(highWins);

// --- loop state ---
let running = false;
let acc = 0;
let last = performance.now();
let prevSnap: InterpSnapshot | null = null;
let roundHold = 0;
let matchShown = false;

function buildControllers(s: GameState, c: MenuChoice): Controller[] {
  const list: Controller[] = [];
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  for (const p of s.players) {
    if (p.isHuman) {
      p.speedMult = 1;
      list[p.id] = new HumanController(input);
    } else {
      p.speedMult = c.difficulty.moveSpeed;
      list[p.id] = new BotController(hashSeed(seed, p.id), c.difficulty);
    }
  }
  return list;
}

function startMatch(c: MenuChoice): void {
  choice = c;
  sfx.resume();
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  state = createMatch(seed, c.neighborhood.skin);
  controllers = buildControllers(state, c);
  renderer.setPalette(paletteForSkin(c.neighborhood.skin), c.neighborhood.skin);
  renderer.resize();
  renderer.snapCamera();
  running = true;
  acc = 0;
  prevSnap = null;
  roundHold = 0;
  matchShown = false;
  menu.hide();
  results.hide();
  setHudVisible(true);
  showRoundIntro();
}

function backToMenu(): void {
  running = false;
  setHudVisible(false);
  results.hide();
  menu.setHighScore(highWins);
  menu.show();
}

function setHudVisible(v: boolean): void {
  hud.root.classList.toggle('hidden', !v);
  hud.prompt.classList.toggle('hidden', !v);
}

function showRoundIntro(): void {
  const attackingHuman = state.attackingTeam === HUMAN_TEAM;
  hud.showBanner(attackingHuman ? 'ATACI: dărâmă castelul!' : 'APERI: păzește castelul!', 1.8);
}

function snapshot(s: GameState): InterpSnapshot {
  const players: Record<number, { x: number; y: number }> = {};
  for (const p of s.players) players[p.id] = { x: p.pos.x, y: p.pos.y };
  return { players, ball: { x: s.ball.pos.x, y: s.ball.pos.y, z: s.ball.z } };
}

function nearestFallen(s: GameState, from: { x: number; y: number }): StoneState | null {
  let best: StoneState | null = null;
  let bestD = Infinity;
  for (const st of s.stones) {
    if (st.status !== 'fallen') continue;
    const d = dist(from, st.pos);
    if (d < bestD) { bestD = d; best = st; }
  }
  return best;
}

function processEvents(s: GameState): void {
  for (const ev of s.events) {
    sfx.play(ev.kind);
    if (ev.kind === 'topple') { renderer.camera.addShake(15); hud.showBanner('CASTELUL A CĂZUT!', 1.2); }
    else if (ev.kind === 'tag') renderer.camera.addShake(8);
  }
  s.events.length = 0;
}

/** Route touches and configure the action button from the human's situation. */
function updateControl(): void {
  const human = state.players[HUMAN_ID];
  if (!running || state.phase === 'roundEnd' || state.phase === 'matchEnd') {
    input.setContext('idle');
    input.setActionButton(false, false, '');
    return;
  }
  if (isThrowContext(state, HUMAN_ID)) {
    input.setContext('throw');
    input.setActionButton(false, false, '');
    return;
  }
  if (state.phase === 'scramble' && human.alive) {
    input.setContext('move');
    let label = 'A';
    let enabled = false;
    if (human.role === 'attacker') {
      if (human.carryingStoneId != null) { label = 'PUNE'; enabled = dist(human.pos, state.basePos) < PLACE_RANGE; }
      else { const st = nearestFallen(state, human.pos); label = 'IA'; enabled = !!st && dist(human.pos, st.pos) < PICKUP_RANGE; }
    } else {
      const b = state.ball;
      label = 'IA';
      enabled = b.heldBy === null && !b.inFlight && dist(human.pos, b.pos) < BALL_GRAB_RANGE;
    }
    input.setActionButton(true, enabled, label);
    return;
  }
  input.setContext('idle');
  input.setActionButton(false, false, '');
}

function updatePrompt(): void {
  const human = state.players[HUMAN_ID];
  let txt = '';
  if (!running) txt = '';
  else if (!human.alive && state.phase === 'scramble') txt = 'Ai fost lovit! Coechipierii continuă.';
  else if (state.phase === 'siege') {
    if (isThrowContext(state, HUMAN_ID)) txt = 'Trage înapoi și dă drumul ca să arunci';
    else if (state.attackingTeam === HUMAN_TEAM) txt = 'Așteaptă-ți rândul la aruncare...';
    else txt = 'Adversarii atacă — pregătește-te să aperi';
  } else if (state.phase === 'scramble') {
    if (human.role === 'attacker') {
      txt = human.carryingStoneId != null ? 'Du piatra la bază și apasă PUNE' : 'Ia o piatră și reconstruiește castelul';
    } else {
      txt = human.holdingBall ? 'Țintește sub genunchi și aruncă!' : 'Prinde mingea și lovește alergătorii';
    }
  }
  hud.setPrompt(txt);
}

function handleTransitions(dt: number): void {
  if (state.phase === 'roundEnd') {
    if (roundHold <= 0 && state.roundWinner) {
      roundHold = ROUND_END_DELAY;
      const won = state.roundWinner === HUMAN_TEAM;
      hud.showBanner(`${won ? 'Ai luat runda!' : 'Rundă pentru ei'} · ${state.roundReason}`, ROUND_END_DELAY);
    } else {
      roundHold -= dt;
      if (roundHold <= 0) {
        startNextRound(state);
        prevSnap = null;
        acc = 0;
        renderer.snapCamera();
        showRoundIntro();
      }
    }
  } else if (state.phase === 'matchEnd' && !matchShown) {
    matchShown = true;
    running = false;
    if (state.matchWinner === HUMAN_TEAM) {
      highWins += 1;
      localStorage.setItem(WINS_KEY, String(highWins));
    }
    results.showMatch(state);
  }
}

function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;

  hud.tick(dt);
  input.tickVisual(dt);
  updateControl();

  if (running) {
    acc += dt;
    let steps = 0;
    while (acc >= TICK && steps < 5) {
      prevSnap = snapshot(state);
      const intents = new Map();
      for (const p of state.players) intents.set(p.id, controllers[p.id].getIntent(state, p.id, TICK));
      step(state, intents, TICK);
      processEvents(state);
      acc -= TICK;
      steps += 1;
    }
    handleTransitions(dt);
  }

  hud.update(state);
  updatePrompt();
  const alpha = running ? acc / TICK : 0;
  renderer.render(state, prevSnap, alpha, input, dt);
  requestAnimationFrame(frame);
}

// --- boot ---
function onResize(): void { renderer.resize(); }
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { /* offline dev: ignore */ });
  });
}

menu.show();
requestAnimationFrame(frame);
