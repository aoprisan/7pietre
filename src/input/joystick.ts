// Floating virtual joystick. Origin spawns where the thumb lands; analog value is
// the capped displacement normalised to [-1, 1]. Works in internal canvas coords.
import { clampLen, type Vec2 } from '../sim/vec';

export class Joystick {
  active = false;
  pointerId = -1;
  origin: Vec2 = { x: 0, y: 0 };
  current: Vec2 = { x: 0, y: 0 };
  readonly maxRadius: number;

  constructor(maxRadius = 72) {
    this.maxRadius = maxRadius;
  }

  start(id: number, pos: Vec2): void {
    this.active = true;
    this.pointerId = id;
    this.origin = { ...pos };
    this.current = { ...pos };
  }
  move(id: number, pos: Vec2): void {
    if (id === this.pointerId) this.current = { ...pos };
  }
  end(id: number): void {
    if (id === this.pointerId) { this.active = false; this.pointerId = -1; }
  }
  cancel(): void { this.active = false; this.pointerId = -1; }

  value(): Vec2 {
    if (!this.active) return { x: 0, y: 0 };
    const d = clampLen({ x: this.current.x - this.origin.x, y: this.current.y - this.origin.y }, this.maxRadius);
    return { x: d.x / this.maxRadius, y: d.y / this.maxRadius };
  }
}
