// RemoteController — the networked-player seam. INTENTIONALLY EMPTY for the MVP:
// it produces no intents. It exists so the interface boundary is real and a
// transport (WebSocket/WebRTC/relay) can later feed intents in here without the
// sim, controllers, or renderer changing shape.
import type { GameState, Intent } from '../sim/types';
import { NO_INTENT } from '../sim/types';
import type { Controller } from './types';

export class RemoteController implements Controller {
  readonly kind = 'remote' as const;

  // Future: a transport pushes the latest intent for `playerId` into a buffer;
  // getIntent() returns the most recent (with prediction/rollback as needed).
  getIntent(_state: GameState, _playerId: number, _dt: number): Intent {
    return NO_INTENT;
  }
}
