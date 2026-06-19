// Drag-to-aim slingshot. Drag BACK from the anchor to set direction + power;
// release to launch in the OPPOSITE direction (like pulling a slingshot).
// Emits a launch vector (unit dir * power 0..1), consumed once by the controller.
import { clamp, len, norm, sub, type Vec2 } from '../sim/vec';

const MIN_POWER = 0.12; // ignore tiny taps

export class DragAim {
  active = false;
  pointerId = -1;
  anchor: Vec2 = { x: 0, y: 0 };
  current: Vec2 = { x: 0, y: 0 };
  readonly maxDrag: number;
  private released: Vec2 | null = null;

  constructor(maxDrag = 150) {
    this.maxDrag = maxDrag;
  }

  start(id: number, pos: Vec2): void {
    this.active = true;
    this.pointerId = id;
    this.anchor = { ...pos };
    this.current = { ...pos };
  }
  move(id: number, pos: Vec2): void {
    if (id === this.pointerId) this.current = { ...pos };
  }
  end(id: number): void {
    if (id !== this.pointerId) return;
    const aim = this.aim();
    if (aim && len(aim) >= MIN_POWER) this.released = aim;
    this.active = false;
    this.pointerId = -1;
  }
  cancel(): void { this.active = false; this.pointerId = -1; this.released = null; }

  /** Current launch vector while dragging (for the renderer's trajectory preview). */
  aim(): Vec2 | null {
    if (!this.active && this.pointerId === -1 && !this.released) {
      // not dragging now
    }
    const drag = sub(this.current, this.anchor);
    const power = clamp(len(drag) / this.maxDrag, 0, 1);
    if (power < 1e-3) return null;
    const dir = norm({ x: -drag.x, y: -drag.y }); // launch opposite the pull
    return { x: dir.x * power, y: dir.y * power };
  }

  /** Pull the committed throw exactly once. */
  consume(): Vec2 | null {
    const r = this.released;
    this.released = null;
    return r;
  }
}
