// All gameplay tuning lives here. The sim is fixed-internal-resolution: 1 world
// unit == 1 internal pixel, portrait 540x960.

export const TICK = 1 / 60; // fixed simulation timestep (seconds)

export const FIELD = { w: 540, h: 960 };

/** Stack base (the "castle"). Upper third of the court. */
export const BASE = { x: 270, y: 250 };

/** Attackers throw from BEHIND this line (larger y = closer to camera/bottom). */
export const THROW_LINE_Y = 700;

export const STONE_COUNT = 7;
export const STACK_RADIUS = 46; // horizontal hit radius of the standing stack
export const STACK_HEIGHT = 86; // vertical extent the ball must pass through to topple

export const PLAYER_RADIUS = 18;
export const BALL_RADIUS = 9;

// movement
export const MOVE_SPEED = 175; // units/sec at full stick
export const CARRY_SPEED_MULT = 0.72; // slowed while carrying a stone

// throw physics (see derivation in README): full-power straight throw from the
// line lands near the base.
export const GRAVITY = 620;
export const THROW_MAX_SPEED = 540;
export const THROW_MAX_VZ = 320;
export const THROW_MIN_POWER = 0.18;

// interaction ranges
export const PICKUP_RANGE = 34;
export const PLACE_RANGE = 40;
export const BALL_GRAB_RANGE = 30;

// tag detection: ball must be low (below the "knee") to count as a hit
export const KNEE_HEIGHT = 30;
export const TAG_GRACE = 1.12; // slight forgiveness on the horizontal hit radius

export const ROUND_SECONDS = 90;
export const ROUND_END_DELAY = 2.6; // seconds the result banner holds before next round
export const MATCH_WINS_NEEDED = 3; // best of 5

export const HUMAN_TEAM: 'A' = 'A';

export interface Difficulty {
  key: 'easy' | 'medium' | 'hard';
  label: string;
  aimNoise: number; // radians of angular jitter added to bot throws
  reactionDelayMs: number; // bot "thinking" delay before acting
  moveSpeed: number; // bot move speed multiplier vs human
}

export const DIFFICULTIES: Difficulty[] = [
  { key: 'easy', label: 'Cartier liniștit', aimNoise: 0.22, reactionDelayMs: 750, moveSpeed: 0.82 },
  { key: 'medium', label: 'Mahala', aimNoise: 0.12, reactionDelayMs: 480, moveSpeed: 0.95 },
  { key: 'hard', label: 'Strada mare', aimNoise: 0.05, reactionDelayMs: 280, moveSpeed: 1.08 },
];

export function difficultyByKey(key: string): Difficulty {
  return DIFFICULTIES.find((d) => d.key === key) ?? DIFFICULTIES[1];
}

export interface Neighborhood {
  id: string;
  name: string;
  subtitle: string;
  desc: string;
  /** palette key resolved in render/palette.ts */
  skin: string;
}

// MVP ships ONE neighborhood. Adding more is just another entry here — the menu
// shape and team-forming logic do not change when real rooms arrive later.
export const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 'cartierul-vechi',
    name: 'Cartierul Vechi',
    subtitle: 'Bloc · 1994 · ora 7 seara',
    desc: 'Asfalt crăpat, covor pe bătător, un Dacia parcat. Generația cu cheia la gât.',
    skin: 'dusk-courtyard',
  },
];
