// Headless render smoke: exercise the REAL Renderer + InputManager against a
// mocked 2D context across siege / scramble / throw-preview, catching draw or
// wiring errors without a browser. Globals are shimmed before importing them.
const noop = () => {};
function mockCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop: noop };
  const target: Record<string, unknown> = {
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  return new Proxy(target, {
    get(t, p: string) { return p in t ? t[p] : noop; },
    set(t, p: string, v) { t[p] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}
function mockCanvas(): HTMLCanvasElement {
  return {
    width: 0, height: 0, style: {},
    getContext: () => mockCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 711, right: 400, bottom: 711 }),
    addEventListener: noop, removeEventListener: noop,
  } as unknown as HTMLCanvasElement;
}
const g = globalThis as unknown as Record<string, unknown>;
g.window = { devicePixelRatio: 2, addEventListener: noop };
g.document = { createElement: () => mockCanvas() };

import { HumanController } from '../src/controllers/human';
import { createMatch, scatterStones } from '../src/sim/state';
import { step } from '../src/sim/step';
import { TICK } from '../src/sim/config';
import { InputManager } from '../src/input/inputManager';
import { paletteForSkin } from '../src/render/palette';
import { Renderer } from '../src/render/renderer';

const canvas = mockCanvas();
const input = new InputManager();
const renderer = new Renderer(canvas, paletteForSkin('dusk-courtyard'), 'dusk-courtyard', 0);
const human = new HumanController(input);

const state = createMatch(42);
let frames = 0;
const draw = () => { renderer.render(state, null, 0, input, TICK); frames++; };

// 1) siege backdrop
draw();

// 2) siege throw preview: human is first thrower; simulate an active slingshot drag
input.setContext('throw');
input.drag.start(1, { x: 270, y: 760 });
input.drag.move(1, { x: 280, y: 880 });
void human.getIntent(state, 0, TICK);
draw();

// 3) scramble with fallen stones, a carrier, an in-flight ball, action button
scatterStones(state);
state.phase = 'scramble';
state.players[0].role = 'attacker';
state.players[0].carryingStoneId = state.stones[0].id;
state.stones[0].status = 'carried';
state.players[3].role = 'defender';
state.ball = { pos: { x: 270, y: 400 }, vel: { x: 0, y: -120 }, z: 18, vz: 40, inFlight: true, heldBy: null, thrownBy: 3, restTimer: 0 };
input.setContext('move');
input.setActionButton(true, true, 'IA');
input.joystick.start(2, { x: 120, y: 600 });
input.joystick.move(2, { x: 150, y: 560 });
for (let i = 0; i < 30; i++) { step(state, new Map(), TICK); draw(); }

console.log(`render-smoke OK — ${frames} frames drawn across siege/preview/scramble`);
