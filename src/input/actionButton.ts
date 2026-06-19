// One contextual action button (bottom-right). Pick up / place stone, grab ball.
import { dist, type Vec2 } from '../sim/vec';

export class ActionButton {
  center: Vec2;
  radius: number;
  visible = false;
  enabled = false;
  label = '';
  pressFlash = 0;
  private edge = false;

  constructor(center: Vec2, radius = 56) {
    this.center = center;
    this.radius = radius;
  }

  hit(pos: Vec2): boolean {
    return this.visible && this.enabled && dist(pos, this.center) <= this.radius * 1.25;
  }
  press(): void {
    if (this.visible && this.enabled) { this.edge = true; this.pressFlash = 0.18; }
  }
  consume(): boolean {
    const e = this.edge;
    this.edge = false;
    return e;
  }
}
