// Owns the three input devices and routes pointer events to them based on the
// current control CONTEXT (set each frame by the app from game state). Implements
// HumanInputSource so the HumanController stays DOM-free. Mouse mirrors touch via
// the Pointer Events API for desktop dev.
import { FIELD } from '../sim/config';
import type { Vec2 } from '../sim/vec';
import type { HumanInputSource } from '../controllers/types';
import { ActionButton } from './actionButton';
import { DragAim } from './dragAim';
import { Joystick } from './joystick';

export type ControlContext = 'throw' | 'move' | 'idle';

export class InputManager implements HumanInputSource {
  readonly joystick = new Joystick(72);
  readonly drag = new DragAim(150);
  readonly action = new ActionButton({ x: FIELD.w - 84, y: FIELD.h - 118 }, 58);

  private context: ControlContext = 'idle';
  private buttonPointer = -1;
  /** maps client (CSS px) coords -> internal canvas coords; set by main. */
  private mapToInternal: (cx: number, cy: number) => Vec2 = (cx, cy) => ({ x: cx, y: cy });

  attach(canvas: HTMLCanvasElement, mapper: (cx: number, cy: number) => Vec2): void {
    this.mapToInternal = mapper;
    const down = (e: PointerEvent) => this.onDown(e);
    const move = (e: PointerEvent) => this.onMove(e);
    const up = (e: PointerEvent) => this.onUp(e);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setContext(ctx: ControlContext): void {
    if (ctx === this.context) return;
    this.context = ctx;
    // dropping a context cancels its in-progress gesture so nothing leaks across.
    if (ctx !== 'throw') this.drag.cancel();
    if (ctx !== 'move') { this.joystick.cancel(); this.buttonPointer = -1; }
  }
  getContext(): ControlContext { return this.context; }

  setActionButton(visible: boolean, enabled: boolean, label: string): void {
    this.action.visible = visible;
    this.action.enabled = enabled;
    this.action.label = label;
  }

  tickVisual(dt: number): void {
    if (this.action.pressFlash > 0) this.action.pressFlash = Math.max(0, this.action.pressFlash - dt);
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    const pos = this.mapToInternal(e.clientX, e.clientY);
    const id = e.pointerId;
    if (this.context === 'throw') {
      this.drag.start(id, pos);
    } else if (this.context === 'move') {
      if (this.action.hit(pos)) { this.action.press(); this.buttonPointer = id; }
      else if (!this.joystick.active) { this.joystick.start(id, pos); }
    }
  }

  private onMove(e: PointerEvent): void {
    e.preventDefault();
    const pos = this.mapToInternal(e.clientX, e.clientY);
    const id = e.pointerId;
    this.drag.move(id, pos);
    this.joystick.move(id, pos);
  }

  private onUp(e: PointerEvent): void {
    e.preventDefault();
    const id = e.pointerId;
    this.drag.end(id);
    this.joystick.end(id);
    if (id === this.buttonPointer) this.buttonPointer = -1;
  }

  // ---- HumanInputSource ----
  moveVector(): Vec2 { return this.joystick.value(); }
  consumeThrow(): Vec2 | null { return this.drag.consume(); }
  consumeAction(): boolean { return this.action.consume(); }
}
