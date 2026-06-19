// Reads the touch/mouse input layer and turns it into Intent. Knows nothing
// about how the input is captured — only the HumanInputSource contract.
import type { GameState, Intent } from '../sim/types';
import type { Controller, HumanInputSource } from './types';

/** Is the human currently in "aim a throw" mode (vs joystick movement)? */
export function isThrowContext(state: GameState, playerId: number): boolean {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return false;
  if (state.phase === 'siege') {
    const current = state.siege.order[state.siege.index];
    return current === playerId && !p.hasThrown && state.ball.heldBy === playerId;
  }
  if (state.phase === 'scramble') return p.holdingBall;
  return false;
}

export class HumanController implements Controller {
  readonly kind = 'human' as const;
  constructor(private readonly input: HumanInputSource) {}

  getIntent(state: GameState, playerId: number, _dt: number): Intent {
    const move = this.input.moveVector();
    let aim: { x: number; y: number } | null = null;
    let action: Intent['action'] = null;

    if (isThrowContext(state, playerId)) {
      const thrown = this.input.consumeThrow();
      if (thrown) { aim = thrown; action = 'throwBall'; }
    } else if (this.input.consumeAction()) {
      action = 'placeStone';
    }
    return { move, aim, action };
  }
}
