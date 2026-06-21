// Match / round construction and (re)setup. Pure data factories — no DOM, no RNG
// beyond the seeded sim stream.
import {
  BASE, FIELD, HUMAN_TEAM, MOVE_SPEED, obstaclesForSkin, PLAYER_RADIUS, ROUND_SECONDS,
  STONE_COUNT, THROW_LINE_Y,
} from './config';
import { pushOutOfObstacles } from './geom';
import { rollRange } from './rng';
import type { GameState, PlayerState, Role, StoneState, Team } from './types';
import { v } from './vec';

export const PLAYER_SPEED = MOVE_SPEED;

function makePlayer(id: number, team: Team, isHuman: boolean): PlayerState {
  return {
    id, team, isHuman,
    role: 'attacker',
    pos: v(0, 0),
    vel: v(0, 0),
    facing: v(0, -1),
    alive: true,
    hasThrown: false,
    carryingStoneId: null,
    holdingBall: false,
    radius: PLAYER_RADIUS,
    speedMult: 1,
    hitFlash: 0,
  };
}

function makeStone(id: number): StoneState {
  return { id, order: id, pos: v(BASE.x, BASE.y), status: 'stacked', carriedBy: null, spin: 0 };
}

/** Create a fresh match. Human is player 0 on team A; bots fill the rest. */
export function createMatch(seed: number, skin = 'dusk-courtyard'): GameState {
  const players: PlayerState[] = [
    makePlayer(0, 'A', true),
    makePlayer(1, 'A', false),
    makePlayer(2, 'A', false),
    makePlayer(3, 'B', false),
    makePlayer(4, 'B', false),
    makePlayer(5, 'B', false),
  ];
  const stones: StoneState[] = [];
  for (let i = 0; i < STONE_COUNT; i++) stones.push(makeStone(i));

  const state: GameState = {
    phase: 'siege',
    tick: 0,
    rng: seed >>> 0,
    field: { ...FIELD },
    basePos: v(BASE.x, BASE.y),
    throwLineY: THROW_LINE_Y,
    obstacles: obstaclesForSkin(skin),
    players,
    stones,
    ball: { pos: v(BASE.x, THROW_LINE_Y + 40), vel: v(0, 0), z: 0, vz: 0, inFlight: false, heldBy: null, thrownBy: null, restTimer: 0 },
    attackingTeam: HUMAN_TEAM, // human's team attacks first — they get the fun throw
    round: 1,
    scores: { A: 0, B: 0 },
    stackPlaced: STONE_COUNT,
    timer: ROUND_SECONDS,
    siege: { order: [], index: 0, turnTimer: 0 },
    roundWinner: null,
    matchWinner: null,
    roundReason: '',
    events: [],
  };
  setupRound(state);
  return state;
}

function attackersOf(state: GameState): PlayerState[] {
  return state.players.filter((p) => p.team === state.attackingTeam);
}

/** Reset positions/stones/ball for a new round given the current attackingTeam. */
export function setupRound(state: GameState): void {
  state.phase = 'siege';
  state.stackPlaced = STONE_COUNT;
  state.timer = ROUND_SECONDS;
  state.roundWinner = null;
  state.roundReason = '';
  state.events = [];

  for (const p of state.players) {
    const role: Role = p.team === state.attackingTeam ? 'attacker' : 'defender';
    p.role = role;
    p.vel = v(0, 0);
    p.alive = true;
    p.hasThrown = false;
    p.carryingStoneId = null;
    p.holdingBall = false;
    p.hitFlash = 0;
    p.facing = v(0, -1);
  }

  // Attackers line up behind the throw line; defenders guard the court ahead of base.
  const attackers = attackersOf(state).sort((a, b) => a.id - b.id);
  const defenders = state.players.filter((p) => p.team !== state.attackingTeam).sort((a, b) => a.id - b.id);
  const lineXs = [150, 270, 390];
  attackers.forEach((p, i) => { p.pos = v(lineXs[i % 3], THROW_LINE_Y + 56); });
  const defXs = [165, 270, 375];
  defenders.forEach((p, i) => { p.pos = v(defXs[i % 3], BASE.y + 150); });

  // Nudge anyone who spawned inside a cover footprint back onto open ground.
  for (const p of state.players) {
    const f = pushOutOfObstacles(p.pos.x, p.pos.y, p.radius, state.obstacles);
    p.pos = v(f.x, f.y);
  }

  // Reset stones into the standing stack.
  for (const s of state.stones) {
    s.status = 'stacked';
    s.carriedBy = null;
    s.spin = 0;
    s.pos = v(BASE.x, BASE.y);
  }

  // Siege turn order = attackers by id; ball starts in the first thrower's hand.
  state.siege = { order: attackers.map((p) => p.id), index: 0, turnTimer: 0 };
  const first = attackers[0];
  state.ball = {
    pos: v(first.pos.x, first.pos.y),
    vel: v(0, 0), z: 0, vz: 0, inFlight: false,
    heldBy: first.id, thrownBy: null, restTimer: 0,
  };
  first.holdingBall = true;
}

/** Advance to the next round (or match end). Call after a roundEnd hold. */
export function startNextRound(state: GameState): void {
  state.round += 1;
  state.attackingTeam = state.attackingTeam === 'A' ? 'B' : 'A';
  setupRound(state);
}

/** Scatter the 7 stones around the base when the castle is toppled. */
export function scatterStones(state: GameState): void {
  for (const s of state.stones) {
    const ang = rollRange(state, 0, Math.PI * 2);
    const r = rollRange(state, 70, 165);
    let x = BASE.x + Math.cos(ang) * r;
    let y = BASE.y + Math.sin(ang) * r * 0.85; // slightly squashed spread
    x = Math.max(40, Math.min(FIELD.w - 40, x));
    y = Math.max(80, Math.min(THROW_LINE_Y - 10, y));
    // Keep stones off obstacle footprints so a runner can actually reach them
    // (a player can't enter the footprint to pick one up). Pad by PLAYER_RADIUS.
    const clear = pushOutOfObstacles(x, y, PLAYER_RADIUS, state.obstacles);
    x = clear.x; y = clear.y;
    s.status = 'fallen';
    s.carriedBy = null;
    s.spin = rollRange(state, -1, 1);
    s.pos = v(x, y);
  }
  state.stackPlaced = 0;
}
