import type { Obstacle } from './config';
import type { Vec2 } from './vec';

export type Team = 'A' | 'B';
export type Role = 'attacker' | 'defender';

/** Round lifecycle. The match wraps several rounds (best of 5). */
export type Phase = 'siege' | 'scramble' | 'roundEnd' | 'matchEnd';

/** The two contextual actions a controller can request. `placeStone` doubles as
 *  the generic "grab/place" context action (pick up stone, place stone, grab ball). */
export type ActionKind = 'throwBall' | 'placeStone';

/** The ONLY thing a controller produces. Human, bot and remote all speak this. */
export interface Intent {
  /** Desired movement, each axis in [-1, 1]. */
  move: Vec2;
  /** Launch vector for a throw: direction * power(0..1). Consumed only with action==='throwBall'. */
  aim: Vec2 | null;
  action: ActionKind | null;
}

export const NO_INTENT: Intent = { move: { x: 0, y: 0 }, aim: null, action: null };

export interface PlayerState {
  id: number;
  team: Team;
  role: Role;
  isHuman: boolean;
  pos: Vec2;
  vel: Vec2;
  facing: Vec2;
  /** false once tagged out during scramble. */
  alive: boolean;
  /** siege: has this attacker used their single throw. */
  hasThrown: boolean;
  carryingStoneId: number | null;
  holdingBall: boolean;
  radius: number;
  /** movement multiplier (1 = human baseline; bots set from difficulty). */
  speedMult: number;
  /** Visual: brief flash timer after being tagged. */
  hitFlash: number;
}

export type StoneStatus = 'stacked' | 'fallen' | 'carried' | 'placed';

export interface StoneState {
  id: number;
  /** intended order in the stack, 0 = bottom. */
  order: number;
  pos: Vec2;
  status: StoneStatus;
  carriedBy: number | null;
  /** wobble animation seed for the toppling scatter. */
  spin: number;
}

export interface BallState {
  pos: Vec2;
  vel: Vec2;
  /** height above ground (for the arc + low-hitbox checks). */
  z: number;
  vz: number;
  inFlight: boolean;
  heldBy: number | null;
  thrownBy: number | null;
  /** seconds the ball has been resting on the ground (siege miss resolution). */
  restTimer: number;
}

export interface SiegeState {
  /** player ids, in throw order. */
  order: number[];
  index: number;
  /** time the current thrower has been "on the clock" (bot reaction / human aim). */
  turnTimer: number;
}

export type GameEventKind =
  | 'throw'
  | 'topple'
  | 'pickupStone'
  | 'placeStone'
  | 'pickupBall'
  | 'tag'
  | 'roundWin'
  | 'bounce';

export interface GameEvent {
  kind: GameEventKind;
  at: Vec2;
  team?: Team;
}

export interface GameState {
  phase: Phase;
  tick: number;
  rng: number;
  field: { w: number; h: number };
  basePos: Vec2;
  throwLineY: number;
  /** Static cover obstacles for the current skin (footprint AABB + z-height). */
  obstacles: Obstacle[];
  players: PlayerState[];
  stones: StoneState[];
  ball: BallState;
  attackingTeam: Team;
  round: number; // 1-based
  scores: { A: number; B: number };
  /** stones currently restacked at base (siege starts at full count). */
  stackPlaced: number;
  timer: number; // seconds remaining in round
  siege: SiegeState;
  roundWinner: Team | null;
  matchWinner: Team | null;
  /** Reason text for the most recent round resolution (UI). */
  roundReason: string;
  /** transient feedback for renderer/audio; cleared by the loop each frame. */
  events: GameEvent[];
}
