// Local AI. One class covers both roles (attacker/defender) and dispatches on the
// player's CURRENT role each frame, so the same controller survives role swaps
// between rounds. Difficulty = three knobs: aimNoise, reactionDelay, moveSpeed
// (moveSpeed is applied via player.speedMult in the sim; the other two live here).
import {
  BALL_GRAB_RANGE, GRAVITY, PICKUP_RANGE, PLACE_RANGE,
  THROW_MAX_SPEED, THROW_MAX_VZ, THROW_MIN_POWER, type Difficulty,
} from '../sim/config';
import { RNG } from '../sim/rng';
import type { GameState, Intent, PlayerState } from '../sim/types';
import { NO_INTENT } from '../sim/types';
import { add, clamp, dist, dot, len, norm, perp, scale, sub, type Vec2 } from '../sim/vec';
import type { Controller } from './types';

/** Power (0..1) needed for a thrown arc to LAND at horizontal distance d. */
function powerForDistance(d: number): number {
  const p = Math.sqrt((d * GRAVITY) / (2 * THROW_MAX_SPEED * THROW_MAX_VZ));
  return clamp(p, THROW_MIN_POWER, 1);
}

export class BotController implements Controller {
  readonly kind = 'bot' as const;
  private rng: RNG;
  private aimNoise: number;
  private reactDelay: number;

  private lastPhase: GameState['phase'] | null = null;
  private armedIndex = -1;
  private siegeTimer = 0;
  private wasHolding = false;
  private holdTimer = 0;
  private scrambleDelay = 0;

  constructor(seed: number, diff: Difficulty) {
    this.rng = new RNG(seed);
    this.aimNoise = diff.aimNoise;
    this.reactDelay = diff.reactionDelayMs / 1000;
  }

  getIntent(state: GameState, playerId: number, dt: number): Intent {
    const p = state.players.find((pl) => pl.id === playerId);
    if (!p) return NO_INTENT;

    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase;
      if (state.phase === 'scramble') this.scrambleDelay = this.reactDelay * this.rng.range(0.4, 1.3);
    }

    if (state.phase === 'siege') return this.siege(state, p, dt);
    if (state.phase === 'scramble') {
      if (this.scrambleDelay > 0) this.scrambleDelay -= dt;
      return p.role === 'attacker' ? this.attacker(state, p) : this.defender(state, p, dt);
    }
    return NO_INTENT;
  }

  // ---- SIEGE ----
  private siege(state: GameState, p: PlayerState, dt: number): Intent {
    if (p.role !== 'attacker') return NO_INTENT;
    const myTurn = state.siege.order[state.siege.index] === p.id;
    if (!myTurn || p.hasThrown || state.ball.heldBy !== p.id) return NO_INTENT;

    if (this.armedIndex !== state.siege.index) { this.armedIndex = state.siege.index; this.siegeTimer = 0; }
    this.siegeTimer += dt;
    if (this.siegeTimer < this.reactDelay) return NO_INTENT;

    return { move: { x: 0, y: 0 }, aim: this.aimThrow(p.pos, state.basePos, 0), action: 'throwBall' };
  }

  /** Build a launch vector (dir*power) that lands at target, plus aim noise. */
  private aimThrow(from: Vec2, target: Vec2, lead: number): Vec2 {
    const d = dist(from, target);
    let power = powerForDistance(d) * (1 + this.rng.noise(0.05));
    power = clamp(power, THROW_MIN_POWER, 1);
    const dir = norm(sub(target, from));
    void lead;
    const ang = Math.atan2(dir.y, dir.x) + this.rng.noise(this.aimNoise);
    return { x: Math.cos(ang) * power, y: Math.sin(ang) * power };
  }

  // ---- SCRAMBLE: attacker ----
  private attacker(state: GameState, p: PlayerState): Intent {
    const carrying = p.carryingStoneId != null;
    const target = carrying ? state.basePos : this.nearestFallenStone(state, p.pos)?.pos;
    if (!target) return NO_INTENT;

    let move = norm(sub(target, p.pos));
    move = this.dodge(state, p, move);
    if (this.scrambleDelay > 0) move = { x: 0, y: 0 };

    let action: Intent['action'] = null;
    if (carrying) {
      if (dist(p.pos, state.basePos) < PLACE_RANGE - 3) action = 'placeStone';
    } else {
      const st = this.nearestFallenStone(state, p.pos);
      if (st && dist(p.pos, st.pos) < PICKUP_RANGE - 3) action = 'placeStone';
    }
    return { move, aim: null, action };
  }

  /** Add a sidestep if an incoming defender ball is bearing down on us. */
  private dodge(state: GameState, p: PlayerState, move: Vec2): Vec2 {
    const b = state.ball;
    if (!b.inFlight || b.thrownBy == null) return move;
    const thrower = state.players.find((pl) => pl.id === b.thrownBy);
    if (!thrower || thrower.role !== 'defender') return move;
    const toMe = sub(p.pos, b.pos);
    const d = len(toMe);
    if (d > 175 || len(b.vel) < 1) return move;
    if (dot(norm(b.vel), norm(toMe)) < 0.55) return move;
    const side = b.vel.x * toMe.y - b.vel.y * toMe.x > 0 ? 1 : -1;
    const sidestep = scale(norm(perp(b.vel)), side);
    return norm(add(move, scale(sidestep, 1.6)));
  }

  // ---- SCRAMBLE: defender ----
  private defender(state: GameState, p: PlayerState, dt: number): Intent {
    const b = state.ball;

    if (p.holdingBall) {
      if (!this.wasHolding) { this.wasHolding = true; this.holdTimer = 0; }
      this.holdTimer += dt;
      if (this.holdTimer >= this.reactDelay) {
        const aim = this.defenseThrow(state, p);
        if (aim) { this.wasHolding = false; return { move: { x: 0, y: 0 }, aim, action: 'throwBall' }; }
      }
      return { move: { x: 0, y: 0 }, aim: null, action: null };
    }
    this.wasHolding = false;

    if (b.heldBy === null && !b.inFlight && this.closestDefenderToBall(state, p)) {
      let move = norm(sub(b.pos, p.pos));
      let action: Intent['action'] = dist(p.pos, b.pos) < BALL_GRAB_RANGE - 3 ? 'placeStone' : null;
      if (this.scrambleDelay > 0) { move = { x: 0, y: 0 }; action = null; }
      return { move, aim: null, action };
    }

    const guard = this.guardPoint(state, p);
    let move = dist(p.pos, guard) < 26 ? { x: 0, y: 0 } : norm(sub(guard, p.pos));
    if (this.scrambleDelay > 0) move = { x: 0, y: 0 };
    return { move, aim: null, action: null };
  }

  private defenseThrow(state: GameState, p: PlayerState): Vec2 | null {
    const attackers = state.players.filter((a) => a.role === 'attacker' && a.alive);
    if (attackers.length === 0) return null;
    let target = attackers[0];
    let bestD = dist(p.pos, target.pos);
    for (const a of attackers) {
      const d = dist(p.pos, a.pos);
      if (d < bestD) { bestD = d; target = a; }
    }
    // "pass when blocked": if the runner is far and a teammate is much closer, relay.
    const relay = this.passTarget(state, p, target);
    if (relay) return this.aimThrow(p.pos, relay.pos, 0);

    // Lead the runner by the ball's estimated flight time so the arc lands on them.
    const d0 = dist(p.pos, target.pos);
    const power0 = powerForDistance(d0);
    const flight = (2 * power0 * THROW_MAX_VZ) / GRAVITY;
    const aimPt = { x: target.pos.x + target.vel.x * flight, y: target.pos.y + target.vel.y * flight };
    return this.aimThrow(p.pos, aimPt, 0);
  }

  private passTarget(state: GameState, p: PlayerState, target: PlayerState): PlayerState | null {
    if (dist(p.pos, target.pos) < 300) return null;
    const mates = state.players.filter((d) => d.role === 'defender' && d.id !== p.id && d.alive);
    let best: PlayerState | null = null;
    let bestGain = 80; // require a meaningful improvement to bother passing
    for (const m of mates) {
      const gain = dist(p.pos, target.pos) - dist(m.pos, target.pos);
      if (gain > bestGain && dist(p.pos, m.pos) < 280) { bestGain = gain; best = m; }
    }
    return best;
  }

  private nearestFallenStone(state: GameState, from: Vec2) {
    let best = null as null | (typeof state.stones)[number];
    let bestD = Infinity;
    for (const s of state.stones) {
      if (s.status !== 'fallen') continue;
      const d = dist(from, s.pos);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  private closestDefenderToBall(state: GameState, p: PlayerState): boolean {
    const defs = state.players.filter((d) => d.role === 'defender' && d.alive);
    let closest = p;
    let bestD = dist(p.pos, state.ball.pos);
    for (const d of defs) {
      const dd = dist(d.pos, state.ball.pos);
      if (dd < bestD - 0.001 || (Math.abs(dd - bestD) < 0.001 && d.id < closest.id)) { bestD = dd; closest = d; }
    }
    return closest.id === p.id;
  }

  private guardPoint(state: GameState, p: PlayerState): Vec2 {
    const att = state.players.filter((a) => a.role === 'attacker' && a.alive);
    let cx = state.basePos.x;
    let cy = state.basePos.y + 120;
    if (att.length > 0) {
      cx = att.reduce((s, a) => s + a.pos.x, 0) / att.length;
      cy = att.reduce((s, a) => s + a.pos.y, 0) / att.length;
    }
    // sit between base and the runners, fanned out a little by player id
    const gx = state.basePos.x * 0.45 + cx * 0.55 + (p.id - 4) * 46;
    const gy = state.basePos.y * 0.45 + cy * 0.55;
    return { x: gx, y: gy };
  }
}
