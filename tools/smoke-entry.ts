// Headless smoke test: drive ALL six players with bots (no DOM/input) and run
// full matches at the fixed timestep, asserting the core loop actually resolves.
import { BotController } from '../src/controllers/bot';
import type { Controller } from '../src/controllers/types';
import { DIFFICULTIES, TICK } from '../src/sim/config';
import { hashSeed } from '../src/sim/rng';
import { createMatch, startNextRound } from '../src/sim/state';
import { step } from '../src/sim/step';
import type { GameState } from '../src/sim/types';

function allBots(s: GameState, diffIndex: number): Controller[] {
  const diff = DIFFICULTIES[diffIndex];
  const list: Controller[] = [];
  for (const p of s.players) {
    p.speedMult = p.isHuman ? 1 : diff.moveSpeed;
    list[p.id] = new BotController(hashSeed(0xabcd, p.id, diffIndex), diff);
  }
  return list;
}

function runMatch(seed: number, diffIndex: number): { rounds: number; winner: string; toppled: number; rebuilt: number } {
  const s = createMatch(seed);
  const c = allBots(s, diffIndex);
  let rounds = 0;
  let toppled = 0;
  let rebuilt = 0;
  let roundHold = 0;
  let lastPhase = s.phase;
  let guard = 0;

  while (s.phase !== 'matchEnd' && guard < 60 * 60 * 12) {
    guard++;
    const intents = new Map();
    for (const p of s.players) intents.set(p.id, c[p.id].getIntent(s, p.id, TICK));
    step(s, intents, TICK);
    for (const ev of s.events) {
      if (ev.kind === 'topple') toppled++;
      if (ev.kind === 'roundWin' && s.roundReason.includes('reconstruit')) rebuilt++;
    }
    s.events.length = 0;

    if (s.phase === 'roundEnd' && lastPhase !== 'roundEnd') { rounds++; roundHold = 0; }
    if (s.phase === 'roundEnd') {
      roundHold += TICK;
      if (roundHold >= 0.1) startNextRound(s);
    }
    lastPhase = s.phase;
  }
  if (s.phase === 'matchEnd') rounds++;
  return { rounds, winner: s.matchWinner ?? '(none)', toppled, rebuilt };
}

let fail = 0;
for (let diff = 0; diff < DIFFICULTIES.length; diff++) {
  for (let seed = 1; seed <= 6; seed++) {
    const r = runMatch(seed * 7919, diff);
    const ok = (r.winner === 'A' || r.winner === 'B') && r.rounds >= 3 && r.rounds <= 5 && r.toppled > 0;
    if (!ok) fail++;
    console.log(
      `diff=${DIFFICULTIES[diff].key.padEnd(6)} seed=${seed} -> winner=${r.winner} rounds=${r.rounds} topples=${r.toppled} rebuilds=${r.rebuilt} ${ok ? 'OK' : 'FAIL'}`
    );
  }
}
console.log(fail === 0 ? '\nALL OK' : `\n${fail} FAILURES`);
if (fail > 0) process.exit(1);
