// All gameplay tuning lives here. The sim is fixed-internal-resolution: 1 world
// unit == 1 internal pixel, portrait 540x960.

export const TICK = 1 / 60; // fixed simulation timestep (seconds)

// FIELD is the whole world (bigger than one screen); VIEW is the window the camera
// shows on screen at a fixed zoom. FIELD.w == VIEW.w means the camera pans vertically
// only. VIEW is consumed ONLY by the renderer — the sim never reads it.
export const FIELD = { w: 540, h: 1500 };
export const VIEW = { w: 540, h: 960 };

/** Stack base (the "castle"). Upper third of the court. */
export const BASE = { x: 270, y: 360 };

/** Attackers throw from BEHIND this line (larger y = closer to camera/bottom).
 * Kept 450 below BASE so the throw arc (tuned for that distance) needs no re-tuning. */
export const THROW_LINE_Y = 810;

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
  {
    id: 'cartierul-nou',
    name: 'Cartierul Nou',
    subtitle: 'Bloc · vară · amiază',
    desc: 'Soare în cap, castani verzi, asfalt încins. Mingea sare mai tare la amiază.',
    skin: 'noon-courtyard',
  },
];

/** A static piece of courtyard cover (the car, rug-rack, bins, trees). `x,y,w,h`
 * is the ground footprint (AABB, world units); `z` is the height a thrown ball
 * must clear to pass over it. Players can't walk through it; a low ball is blocked
 * by it, so a player hidden behind one can't be tagged. */
export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  label: string;
  /** Whether a low ball is blocked by it (default true). The building sets this
   * false: it stops players but lets throws reach the stack at its foot. */
  ball?: boolean;
}

// Per-skin obstacle footprints, authored against the backdrop art. Keep these
// clear of the base circle (BASE, r≈54) and the throw line (y=810). Tune visually
// with the `?debug` overlay (which draws each box + its z-height).
// IMPORTANT: keep obstacles off the base circle (BASE, r≈54) and out of the
// central rebuild lane (x≈230–310, y 360→810) — an obstacle there blocks attackers
// from carrying stones back to the base and makes the round unwinnable for them.
const OBSTACLES: Record<string, Obstacle[]> = {
  'noon-courtyard': [
    { x: 368, y: 380, w: 110, h: 95, z: 42, label: 'car' },
    { x: 110, y: 362, w: 85, h: 46, z: 50, label: 'bins' },
    { x: 20, y: 780, w: 95, h: 60, z: 90, label: 'rack' },
    { x: 0, y: 400, w: 85, h: 250, z: 130, label: 'trees' },
  ],
  'dusk-courtyard': [
    { x: 348, y: 362, w: 130, h: 98, z: 42, label: 'car' },
    { x: 20, y: 820, w: 85, h: 150, z: 95, label: 'rug-rack' },
    { x: 110, y: 362, w: 85, h: 46, z: 50, label: 'bins' },
    { x: 0, y: 400, w: 85, h: 250, z: 130, label: 'trees' },
  ],
};

// The apartment bloc occupies the whole top band above the horizon (BASE.y).
// Players can't walk onto it, but it does NOT block the ball — the stack sits at
// its foot (y=BASE.y), so a ball-blocking building would stop every throw before
// it could topple the castle. Shared across skins.
//
// We leave a thin walkable apron of courtyard at the very foot (BUILDING_APRON):
// the castle is flush against the wall, so a full-height wall would make the base
// a 1-D chokepoint that attackers can't fan around — rebuilds collapse. The apron
// keeps ~89% of the bloc off-limits while letting runners reach the base.
const BUILDING_APRON = 40;
const BUILDING: Obstacle = {
  x: 0, y: 0, w: FIELD.w, h: BASE.y - BUILDING_APRON, z: 600, label: 'building', ball: false,
};

export function obstaclesForSkin(skin: string): Obstacle[] {
  return [BUILDING, ...(OBSTACLES[skin] ?? [])];
}
