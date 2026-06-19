// Every player — human, bot, or (future) remote — is just a source of Intent.
// This single seam is what makes players interchangeable and lets real
// multiplayer drop in later without touching the sim.
import type { GameState, Intent } from '../sim/types';

export type ControllerKind = 'human' | 'bot' | 'remote';

export interface Controller {
  readonly kind: ControllerKind;
  /** Produce this player's intent for the upcoming fixed step. */
  getIntent(state: GameState, playerId: number, dt: number): Intent;
}

/** What a HumanController reads from the input layer. The input devices live in
 *  src/input and implement this; the controller stays DOM-free. */
export interface HumanInputSource {
  /** analog movement, each axis in [-1, 1]. */
  moveVector(): { x: number; y: number };
  /** Returns the launch aim (dir * power) once, on slingshot release. */
  consumeThrow(): { x: number; y: number } | null;
  /** Returns true once, on a context-action tap. */
  consumeAction(): boolean;
}
