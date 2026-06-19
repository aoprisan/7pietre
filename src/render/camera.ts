// Following camera over a world larger than the screen. Owns a smoothed world
// center (posX/posY) that eases toward a target, clamped so the VIEW window never
// shows outside the FIELD. Also adds a little screen shake for juice on topples and
// tags. The renderer applies the result; the sim never sees the camera.
import { FIELD, VIEW } from '../sim/config';
import { clamp } from '../sim/vec';

const FOLLOW_RATE = 10; // higher = snappier follow (framerate-independent)

export class Camera {
  // smoothed world-space center of the view
  posX = VIEW.w / 2;
  posY = VIEW.h / 2;
  // additive screen-shake offset (device pixels), applied on top of the pan
  offsetX = 0;
  offsetY = 0;

  private tgtX = VIEW.w / 2;
  private tgtY = VIEW.h / 2;
  private shake = 0;
  private seed = 1234;

  /** Desired world center this frame; clamped so the view stays inside the field. */
  setTarget(x: number, y: number): void {
    const halfW = VIEW.w / 2, halfH = VIEW.h / 2;
    this.tgtX = clamp(x, halfW, Math.max(halfW, FIELD.w - halfW));
    this.tgtY = clamp(y, halfH, Math.max(halfH, FIELD.h - halfH));
  }

  /** Jump straight to the target (round/match start) to avoid a long glide. */
  snapToTarget(): void {
    this.posX = this.tgtX;
    this.posY = this.tgtY;
  }

  addShake(mag: number): void {
    this.shake = Math.min(16, this.shake + mag);
  }

  update(dt: number): void {
    // ease the center toward the target (exponential, framerate-independent)
    const k = 1 - Math.exp(-dt * FOLLOW_RATE);
    this.posX += (this.tgtX - this.posX) * k;
    this.posY += (this.tgtY - this.posY) * k;

    // screen shake
    if (this.shake <= 0.01) { this.shake = 0; this.offsetX = 0; this.offsetY = 0; return; }
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) & 0x7fffffff;
    const a = (this.seed / 0x7fffffff) * Math.PI * 2;
    this.offsetX = Math.cos(a) * this.shake;
    this.offsetY = Math.sin(a) * this.shake;
    this.shake = Math.max(0, this.shake - dt * 48);
  }
}
