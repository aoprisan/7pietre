// The simulation. `step(state, intents, dt)` is the ONE place game state evolves.
// It is deterministic (seeded RNG threaded on state.rng), has no DOM/render/input
// access, and is driven at a FIXED timestep by the game loop.
import {
  BALL_GRAB_RANGE, BALL_RADIUS, CARRY_SPEED_MULT, FIELD, GRAVITY, KNEE_HEIGHT,
  MATCH_WINS_NEEDED, MOVE_SPEED, PICKUP_RANGE, PLACE_RANGE, STACK_HEIGHT,
  STACK_RADIUS, STONE_COUNT, TAG_GRACE, THROW_MAX_SPEED, THROW_MAX_VZ, THROW_MIN_POWER,
} from './config';
import { resolveCircleAabb, segmentHitsAabb } from './geom';
import { scatterStones } from './state';
import type { GameState, Intent, PlayerState, StoneState, Team } from './types';
import { NO_INTENT } from './types';
import { clamp, clampLen, clone, dist, len, norm, scale, v } from './vec';

type Intents = Map<number, Intent>;

const getIntent = (intents: Intents, id: number): Intent => intents.get(id) ?? NO_INTENT;
const playerById = (s: GameState, id: number): PlayerState | undefined => s.players.find((p) => p.id === id);
const stoneById = (s: GameState, id: number): StoneState | undefined => s.stones.find((st) => st.id === id);
const otherTeam = (t: Team): Team => (t === 'A' ? 'B' : 'A');

export function step(state: GameState, intents: Intents, dt: number): void {
  state.tick++;
  for (const p of state.players) if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);

  switch (state.phase) {
    case 'siege': stepSiege(state, intents, dt); break;
    case 'scramble': stepScramble(state, intents, dt); break;
    case 'roundEnd':
    case 'matchEnd':
      // Frozen — the app layer drives round/match transitions after a hold.
      break;
  }
}

// ---------------------------------------------------------------------------
// Movement & ball physics
// ---------------------------------------------------------------------------
function applyMovement(state: GameState, p: PlayerState, intent: Intent, dt: number): void {
  if (!p.alive) { p.vel = v(0, 0); return; }
  const m = clampLen(intent.move, 1);
  const carry = p.carryingStoneId != null ? CARRY_SPEED_MULT : 1;
  const speed = MOVE_SPEED * p.speedMult * carry;
  p.vel = scale(m, speed);
  p.pos = {
    x: clamp(p.pos.x + p.vel.x * dt, 28, FIELD.w - 28),
    y: clamp(p.pos.y + p.vel.y * dt, 60, FIELD.h - 36),
  };
  // Can't walk through cover — push out to the nearest edge (slides along).
  for (const o of state.obstacles) {
    const fixed = resolveCircleAabb(p.pos.x, p.pos.y, p.radius, o);
    if (fixed) p.pos = fixed;
  }
  if (len(m) > 0.05) p.facing = norm(m);

  if (p.carryingStoneId != null) {
    const st = stoneById(state, p.carryingStoneId);
    if (st) st.pos = { x: p.pos.x, y: p.pos.y - 8 };
  }
  if (p.holdingBall) {
    state.ball.pos = { x: p.pos.x + p.facing.x * 12, y: p.pos.y + p.facing.y * 12 };
    state.ball.z = 22;
  }
}

function stepBall(state: GameState, dt: number): void {
  const b = state.ball;
  if (b.heldBy != null) return; // carried; positioned by the holder
  if (b.inFlight) {
    const px = b.pos.x, py = b.pos.y; // pre-step position for the swept cover test
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.z += b.vz * dt;
    b.vz -= GRAVITY * dt;
    // Cover: a low ball that enters an obstacle footprint is stopped (drops there),
    // so it can't reach a player hidden behind it. A high ball clears the top.
    for (const o of state.obstacles) {
      if (o.ball === false) continue; // e.g. the building — players only, ball passes
      if (b.z >= o.z) continue;
      const hit = segmentHitsAabb(px, py, b.pos.x, b.pos.y, o, BALL_RADIUS);
      if (hit) {
        b.pos.x = hit.x; b.pos.y = hit.y;
        b.z = 0; b.vz = 0; b.vel = v(0, 0);
        b.inFlight = false; b.thrownBy = null; b.restTimer = 0;
        state.events.push({ kind: 'bounce', at: clone(b.pos) });
        return;
      }
    }
    if (b.pos.x < 10 || b.pos.x > FIELD.w - 10) { b.pos.x = clamp(b.pos.x, 10, FIELD.w - 10); b.vel.x *= -0.4; }
    if (b.pos.y < 10 || b.pos.y > FIELD.h - 10) { b.pos.y = clamp(b.pos.y, 10, FIELD.h - 10); b.vel.y *= -0.4; }
    if (b.z <= 0) {
      b.z = 0; b.vz = 0; b.vel = v(0, 0);
      b.inFlight = false; b.thrownBy = null; b.restTimer = 0;
      state.events.push({ kind: 'bounce', at: clone(b.pos) });
    }
  } else {
    b.restTimer += dt;
  }
}

function launchThrow(state: GameState, thrower: PlayerState, aim: { x: number; y: number }): void {
  const power = clamp(len(aim), THROW_MIN_POWER, 1);
  const dir = norm(aim);
  const b = state.ball;
  b.heldBy = null;
  thrower.holdingBall = false;
  b.pos = { x: thrower.pos.x + dir.x * 22, y: thrower.pos.y + dir.y * 22 };
  b.z = 24;
  b.vel = scale(dir, THROW_MAX_SPEED * power);
  b.vz = THROW_MAX_VZ * power;
  b.inFlight = true;
  b.thrownBy = thrower.id;
  b.restTimer = 0;
  state.events.push({ kind: 'throw', at: clone(b.pos), team: thrower.team });
}

// ---------------------------------------------------------------------------
// SIEGE: each attacker takes one throw to topple the stack.
// ---------------------------------------------------------------------------
function stepSiege(state: GameState, intents: Intents, dt: number): void {
  stepBall(state, dt);
  state.siege.turnTimer += dt;

  const thrower = playerById(state, state.siege.order[state.siege.index]);
  if (thrower && !thrower.hasThrown && state.ball.heldBy === thrower.id) {
    const intent = getIntent(intents, thrower.id);
    if (intent.action === 'throwBall' && intent.aim) {
      launchThrow(state, thrower, intent.aim);
      thrower.hasThrown = true;
    }
  }

  if (state.ball.inFlight) checkTopple(state);

  // A thrown-and-missed ball that has rested -> hand off to the next attacker.
  if (state.phase === 'siege' && thrower && thrower.hasThrown && !state.ball.inFlight && state.ball.heldBy === null && state.ball.restTimer > 0.5) {
    advanceSiege(state);
  }
}

function checkTopple(state: GameState): void {
  const b = state.ball;
  if (dist(b.pos, state.basePos) < STACK_RADIUS + BALL_RADIUS && b.z < STACK_HEIGHT) {
    state.events.push({ kind: 'topple', at: clone(state.basePos) });
    scatterStones(state);
    // ball settles on the ground near the impact for defenders to fetch
    b.inFlight = false; b.vel = v(0, 0); b.vz = 0; b.z = 0; b.thrownBy = null; b.restTimer = 0;
    beginScramble(state);
  }
}

function advanceSiege(state: GameState): void {
  state.siege.index++;
  state.siege.turnTimer = 0;
  if (state.siege.index >= state.siege.order.length) {
    // every attacker threw and the castle still stands -> defenders hold.
    resolveRound(state, otherTeam(state.attackingTeam), 'Castelul a rezistat!');
    return;
  }
  const next = playerById(state, state.siege.order[state.siege.index]);
  if (next) {
    const b = state.ball;
    b.heldBy = next.id; next.holdingBall = true;
    b.pos = clone(next.pos); b.z = 0; b.inFlight = false; b.vel = v(0, 0); b.vz = 0; b.restTimer = 0;
  }
}

function beginScramble(state: GameState): void {
  state.phase = 'scramble';
  // Defenders break for the ball; attackers (still behind the line) surge in.
}

// ---------------------------------------------------------------------------
// SCRAMBLE: attackers rebuild, defenders fetch ball and tag runners.
// ---------------------------------------------------------------------------
function stepScramble(state: GameState, intents: Intents, dt: number): void {
  state.timer -= dt;

  for (const p of state.players) applyMovement(state, p, getIntent(intents, p.id), dt);
  stepBall(state, dt);

  for (const p of state.players) {
    if (!p.alive) continue;
    const intent = getIntent(intents, p.id);
    if (intent.action === 'throwBall' && intent.aim && p.holdingBall) {
      launchThrow(state, p, intent.aim);
    } else if (intent.action === 'placeStone') {
      contextAction(state, p);
    }
  }

  if (state.ball.inFlight) checkTagHits(state);
  checkScrambleEnd(state);
}

function nearestFallenStone(state: GameState, from: { x: number; y: number }): StoneState | null {
  let best: StoneState | null = null;
  let bestD = Infinity;
  for (const s of state.stones) {
    if (s.status !== 'fallen') continue;
    const d = dist(from, s.pos);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

function contextAction(state: GameState, p: PlayerState): void {
  if (p.role === 'attacker') {
    if (p.carryingStoneId != null) {
      if (dist(p.pos, state.basePos) < PLACE_RANGE) {
        const st = stoneById(state, p.carryingStoneId);
        if (st) {
          st.status = 'placed';
          st.carriedBy = null;
          st.order = state.stackPlaced;
          st.pos = clone(state.basePos);
        }
        p.carryingStoneId = null;
        state.stackPlaced++;
        state.events.push({ kind: 'placeStone', at: clone(state.basePos), team: p.team });
      }
    } else {
      const st = nearestFallenStone(state, p.pos);
      if (st && dist(p.pos, st.pos) < PICKUP_RANGE) {
        st.status = 'carried';
        st.carriedBy = p.id;
        p.carryingStoneId = st.id;
        state.events.push({ kind: 'pickupStone', at: clone(st.pos), team: p.team });
      }
    }
  } else {
    // defender: grab the ball off the ground
    const b = state.ball;
    if (b.heldBy === null && !b.inFlight && dist(p.pos, b.pos) < BALL_GRAB_RANGE) {
      b.heldBy = p.id;
      p.holdingBall = true;
      state.events.push({ kind: 'pickupBall', at: clone(b.pos), team: p.team });
    }
  }
}

function checkTagHits(state: GameState): void {
  const b = state.ball;
  if (b.thrownBy == null) return;
  const thrower = playerById(state, b.thrownBy);
  if (!thrower) return;
  for (const p of state.players) {
    if (p.role !== 'attacker' || !p.alive || p.team === thrower.team) continue;
    if (dist(b.pos, p.pos) < (p.radius + BALL_RADIUS) * TAG_GRACE && b.z < KNEE_HEIGHT) {
      p.alive = false;
      p.hitFlash = 0.7;
      if (p.carryingStoneId != null) {
        const st = stoneById(state, p.carryingStoneId);
        if (st) { st.status = 'fallen'; st.carriedBy = null; }
        p.carryingStoneId = null;
      }
      state.events.push({ kind: 'tag', at: clone(p.pos), team: thrower.team });
      b.inFlight = false; b.vel = v(0, 0); b.vz = 0; b.z = 0; b.thrownBy = null; b.restTimer = 0;
      break;
    }
  }
}

function checkScrambleEnd(state: GameState): void {
  if (state.stackPlaced >= STONE_COUNT) {
    resolveRound(state, state.attackingTeam, 'Castelul reconstruit!');
    return;
  }
  const attackers = state.players.filter((p) => p.role === 'attacker');
  if (attackers.length > 0 && attackers.every((p) => !p.alive)) {
    resolveRound(state, otherTeam(state.attackingTeam), 'Toți alergătorii loviți!');
    return;
  }
  if (state.timer <= 0) {
    state.timer = 0;
    resolveRound(state, otherTeam(state.attackingTeam), 'Timpul a expirat!');
  }
}

// ---------------------------------------------------------------------------
function resolveRound(state: GameState, winner: Team, reason: string): void {
  state.roundWinner = winner;
  state.roundReason = reason;
  state.scores[winner]++;
  state.events.push({ kind: 'roundWin', at: clone(state.basePos), team: winner });
  if (state.scores[winner] >= MATCH_WINS_NEEDED) {
    state.matchWinner = winner;
    state.phase = 'matchEnd';
  } else {
    state.phase = 'roundEnd';
  }
}
