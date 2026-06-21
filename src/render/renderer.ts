// Reads state, draws to canvas, NEVER mutates state. Owns the viewport scaling
// (fixed 540x960 internal resolution, letterboxed/contain into the device) and
// the input overlay drawing. Interpolates entity positions between sim ticks.
import {
  BASE, FIELD, GRAVITY, KNEE_HEIGHT, STACK_HEIGHT, THROW_LINE_Y,
  THROW_MAX_SPEED, THROW_MAX_VZ, VIEW,
} from '../sim/config';
import type { GameState, PlayerState } from '../sim/types';
import { clamp, len, norm, type Vec2 } from '../sim/vec';
import { isThrowContext } from '../controllers/human';
import type { InputManager } from '../input/inputManager';
import { Camera } from './camera';
import type { Palette } from './palette';
import { STONE_COLORS } from './palette';
import { Theme } from './theme';

export interface InterpSnapshot {
  players: Record<number, Vec2>;
  ball: { x: number; y: number; z: number };
}

const Z_SCALE = 0.62; // how strongly height lifts a thing up the screen

export class Renderer {
  readonly camera = new Camera();
  private ctx: CanvasRenderingContext2D;
  private theme = new Theme();
  private dpr = 1;
  private scale = 1;
  private offX = 0;
  private offY = 0;
  private humanId: number;

  constructor(private canvas: HTMLCanvasElement, private pal: Palette, private skin: string, humanId: number, private debug = false) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.humanId = humanId;
    this.resize();
  }

  setPalette(pal: Palette, skin: string): void {
    this.pal = pal;
    this.skin = skin;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    // fixed zoom: fit the VIEW window (not the whole field) into the device.
    this.scale = Math.min(w / VIEW.w, h / VIEW.h);
    this.offX = (w - VIEW.w * this.scale) / 2;
    this.offY = (h - VIEW.h * this.scale) / 2;
  }

  /** Snap the camera straight to its target (round/match start). */
  snapCamera(): void {
    this.camera.snapToTarget();
  }

  // Device px -> VIEW (screen) coords. On-screen gesture inputs (joystick, action
  // button, drag-aim) are device-anchored, so they map through VIEW space — NOT the
  // moving world transform.
  toView(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const dx = (clientX - rect.left) * this.dpr;
    const dy = (clientY - rect.top) * this.dpr;
    return { x: (dx - this.offX) / this.scale, y: (dy - this.offY) / this.scale };
  }

  render(state: GameState, prev: InterpSnapshot | null, alpha: number, input: InputManager, dt: number): void {
    this.theme.ensure(this.pal, this.skin);

    // Aim the camera: follow the human during the scramble, otherwise frame the
    // castle (siege/round-end and the menu backdrop). Uses the SAME interpolated
    // human position as the sprite so camera and player move in lockstep.
    let fx = BASE.x, fy = BASE.y;
    if (state.phase === 'scramble') {
      const human = state.players.find((p) => p.id === this.humanId);
      if (human) { fx = this.ix(human, prev, alpha); fy = this.py(human, prev, alpha); }
    }
    this.camera.setTarget(fx, fy);
    this.camera.update(dt);
    const camOffX = VIEW.w / 2 - this.camera.posX;
    const camOffY = VIEW.h / 2 - this.camera.posY;

    const ctx = this.ctx;

    // letterbox bars
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0a0d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // scene transform: world pan (px = world * scale) + camera shake (device px)
    ctx.setTransform(
      this.scale, 0, 0, this.scale,
      this.offX + camOffX * this.scale + this.camera.offsetX,
      this.offY + camOffY * this.scale + this.camera.offsetY,
    );
    // clip to the visible VIEW window (world coords) so shake can't reveal letterbox
    ctx.beginPath();
    ctx.rect(this.camera.posX - VIEW.w / 2, this.camera.posY - VIEW.h / 2, VIEW.w, VIEW.h);
    ctx.save();
    ctx.clip();

    ctx.drawImage(this.theme.canvas, 0, 0);

    this.drawCastle(state);
    this.drawFallenStones(state);

    // draw players + ball sorted by y for fake depth
    const order = [...state.players].sort((a, b) => this.py(a, prev, alpha) - this.py(b, prev, alpha));
    for (const p of order) this.drawPlayer(state, p, prev, alpha);
    this.drawBall(state, prev, alpha);

    this.drawThrowPreview(state, prev, alpha, input);

    if (this.debug) this.drawDebug(state);

    ctx.restore();

    // input overlay (not clipped/shaken)
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offX, this.offY);
    this.drawJoystick(input);
    this.drawActionButton(input);
  }

  /** `?debug` overlay (world space, so it pans/shakes with the field): the horizon
   * line at BASE.y, the throw line, the court border, and each cover obstacle's
   * footprint + z-height. Doubles as the tool for tuning obstacle rects to the art. */
  private drawDebug(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,60,60,0.9)'; // horizon @ BASE.y
    ctx.beginPath(); ctx.moveTo(0, BASE.y); ctx.lineTo(FIELD.w, BASE.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,220,255,0.9)'; // throw line
    ctx.beginPath(); ctx.moveTo(0, THROW_LINE_Y); ctx.lineTo(FIELD.w, THROW_LINE_Y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; // field border
    ctx.strokeRect(0, 0, FIELD.w, FIELD.h);
    ctx.strokeStyle = 'rgba(255,210,80,0.95)'; // obstacles
    ctx.fillStyle = 'rgba(255,210,80,0.95)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const o of state.obstacles) {
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.fillText(`${o.label} z${o.z}`, o.x + 2, o.y + 2);
    }
    ctx.restore();
  }

  // --- interpolation helpers ---
  private ix(p: PlayerState, prev: InterpSnapshot | null, a: number): number {
    const pv = prev?.players[p.id];
    return pv ? pv.x + (p.pos.x - pv.x) * a : p.pos.x;
  }
  private py(p: PlayerState, prev: InterpSnapshot | null, a: number): number {
    const pv = prev?.players[p.id];
    return pv ? pv.y + (p.pos.y - pv.y) * a : p.pos.y;
  }

  // --- stones ---
  private drawCastle(state: GameState): void {
    const count = state.phase === 'siege' ? state.stones.length : state.stackPlaced;
    this.drawStack(BASE.x, BASE.y, count);
  }

  private drawStack(cx: number, baseY: number, count: number): void {
    const ctx = this.ctx;
    if (count <= 0) {
      // empty foundation hint
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(cx, baseY + 4, 26, 10, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    ctx.fillStyle = this.pal.shadow;
    ctx.beginPath(); ctx.ellipse(cx, baseY + 6, 30, 11, 0, 0, Math.PI * 2); ctx.fill();
    let y = baseY + 2;
    for (let i = 0; i < count; i++) {
      const w = 52 - i * 5.2;
      const h = 13;
      y -= h + 1.5;
      ctx.fillStyle = STONE_COLORS[i % STONE_COLORS.length];
      this.roundRect(cx - w / 2, y, w, h, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      this.roundRect(cx - w / 2, y, w, h * 0.42, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(cx - w / 2 + 2, y + h - 2, w - 4, 2);
    }
  }

  private drawFallenStones(state: GameState): void {
    const ctx = this.ctx;
    for (const s of state.stones) {
      if (s.status !== 'fallen') continue;
      ctx.fillStyle = this.pal.shadow;
      ctx.beginPath(); ctx.ellipse(s.pos.x, s.pos.y + 5, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(s.pos.x, s.pos.y);
      ctx.rotate(s.spin);
      ctx.fillStyle = STONE_COLORS[s.id % STONE_COLORS.length];
      this.roundRect(-13, -7, 26, 14, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      this.roundRect(-13, -7, 26, 6, 4);
      ctx.fill();
      ctx.restore();
    }
  }

  // --- players ---
  private drawPlayer(state: GameState, p: PlayerState, prev: InterpSnapshot | null, a: number): void {
    const ctx = this.ctx;
    const x = this.ix(p, prev, a);
    const y = this.py(p, prev, a);
    const teamCol = p.team === 'A' ? this.pal.teamA : this.pal.teamB;
    const shadeCol = p.team === 'A' ? this.pal.teamAShade : this.pal.teamBShade;

    // shadow
    ctx.fillStyle = this.pal.shadow;
    ctx.beginPath(); ctx.ellipse(x, y + 14, 17, 7, 0, 0, Math.PI * 2); ctx.fill();

    if (!p.alive) {
      // tagged out: slumped, greyed
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#6c6258';
      this.roundRect(x - 15, y - 2, 30, 16, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - 6, 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    const fx = p.facing.x, fy = p.facing.y;

    // low hitbox telegraph (below the knee) — the thing the ball must hit
    if (p.role === 'attacker' && state.phase === 'scramble') {
      ctx.strokeStyle = 'rgba(232,90,58,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 10, 15, 6, 0, 0, Math.PI * 2); ctx.stroke();
    }

    // legs hint
    ctx.fillStyle = shadeCol;
    ctx.fillRect(x - 8, y + 4, 6, 12);
    ctx.fillRect(x + 2, y + 4, 6, 12);

    // body
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : teamCol;
    this.roundRect(x - 13, y - 16, 26, 24, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    this.roundRect(x - 13, y - 16, 26, 9, 8); ctx.fill();

    // head
    ctx.fillStyle = '#e7c39a';
    ctx.beginPath(); ctx.arc(x, y - 24, 9, 0, Math.PI * 2); ctx.fill();
    // facing nub
    ctx.fillStyle = shadeCol;
    ctx.beginPath(); ctx.arc(x + fx * 7, y - 24 + fy * 4, 3.5, 0, Math.PI * 2); ctx.fill();

    // carried stone
    if (p.carryingStoneId != null) {
      ctx.fillStyle = STONE_COLORS[p.carryingStoneId % STONE_COLORS.length];
      this.roundRect(x - 11, y - 40, 22, 12, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      this.roundRect(x - 11, y - 40, 22, 5, 4); ctx.fill();
    }

    // "YOU" marker
    if (p.id === this.humanId) {
      ctx.fillStyle = this.pal.ink;
      ctx.beginPath();
      ctx.moveTo(x, y - 40); ctx.lineTo(x - 6, y - 50); ctx.lineTo(x + 6, y - 50); ctx.closePath();
      if (p.carryingStoneId == null) ctx.fill();
    }

    // current siege thrower pulse
    if (state.phase === 'siege' && state.siege.order[state.siege.index] === p.id && !p.hasThrown) {
      const r = 22 + Math.sin(state.tick * 0.15) * 4;
      ctx.strokeStyle = 'rgba(242,200,121,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 6, r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // --- ball ---
  private drawBall(state: GameState, prev: InterpSnapshot | null, a: number): void {
    const ctx = this.ctx;
    const b = state.ball;
    let bx = b.pos.x, by = b.pos.y, bz = b.z;
    if (prev && b.heldBy == null) {
      bx = prev.ball.x + (b.pos.x - prev.ball.x) * a;
      by = prev.ball.y + (b.pos.y - prev.ball.y) * a;
      bz = prev.ball.z + (b.z - prev.ball.z) * a;
    }
    const screenY = by - bz * Z_SCALE;
    // shadow shrinks with height
    const sh = clamp(1 - bz / 260, 0.35, 1);
    ctx.fillStyle = `rgba(20,12,10,${0.3 * sh})`;
    ctx.beginPath(); ctx.ellipse(bx, by + 4, 9 * sh, 4 * sh, 0, 0, Math.PI * 2); ctx.fill();
    // ball
    ctx.fillStyle = this.pal.ballColor;
    ctx.beginPath(); ctx.arc(bx, screenY, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,180,0.5)';
    ctx.beginPath(); ctx.arc(bx - 3, screenY - 3, 3.4, 0, Math.PI * 2); ctx.fill();
    // low/dangerous indicator when in flight near the ground
    if (b.inFlight && b.z < KNEE_HEIGHT) {
      ctx.strokeStyle = 'rgba(232,90,58,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, screenY, 13, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // --- slingshot trajectory preview ---
  private drawThrowPreview(state: GameState, prev: InterpSnapshot | null, a: number, input: InputManager): void {
    if (!isThrowContext(state, this.humanId)) return;
    if (input.getContext() !== 'throw' || !input.drag.active) return;
    const aim = input.drag.aim();
    if (!aim) return;
    const ctx = this.ctx;
    const p = state.players.find((pl) => pl.id === this.humanId);
    if (!p) return;
    const ox = this.ix(p, prev, a);
    const oy = this.py(p, prev, a) - 8;
    const power = clamp(len(aim), 0, 1);
    const dir = norm(aim);

    // simulate arc
    let px = ox, py = oy, pz = 24;
    let vx = dir.x * THROW_MAX_SPEED * power;
    let vy = dir.y * THROW_MAX_SPEED * power;
    let vz = THROW_MAX_VZ * power;
    const h = 1 / 30;
    ctx.fillStyle = 'rgba(243,233,216,0.85)';
    for (let i = 0; i < 50; i++) {
      px += vx * h; py += vy * h; pz += vz * h; vz -= GRAVITY * h;
      if (pz <= 0) { pz = 0; }
      if (i % 2 === 0) {
        const sy = py - pz * Z_SCALE;
        ctx.beginPath(); ctx.arc(px, sy, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      if (pz <= 0) break;
    }
    // landing marker
    ctx.strokeStyle = 'rgba(243,233,216,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.stroke();

    // power gauge at the hand
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(ox, oy, 26, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = power > 0.85 ? '#e85a3a' : '#f2c879';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(ox, oy, 26, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2); ctx.stroke();
  }

  // --- input overlay ---
  private drawJoystick(input: InputManager): void {
    const j = input.joystick;
    if (!j.active) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(243,233,216,0.10)';
    ctx.beginPath(); ctx.arc(j.origin.x, j.origin.y, j.maxRadius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(243,233,216,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(j.origin.x, j.origin.y, j.maxRadius, 0, Math.PI * 2); ctx.stroke();
    const v = j.value();
    const tx = j.origin.x + v.x * j.maxRadius;
    const ty = j.origin.y + v.y * j.maxRadius;
    ctx.fillStyle = 'rgba(243,233,216,0.85)';
    ctx.beginPath(); ctx.arc(tx, ty, 28, 0, Math.PI * 2); ctx.fill();
  }

  private drawActionButton(input: InputManager): void {
    const a = input.action;
    if (!a.visible) return;
    const ctx = this.ctx;
    const r = a.radius * (1 + a.pressFlash * 0.4);
    ctx.globalAlpha = a.enabled ? 1 : 0.4;
    ctx.fillStyle = 'rgba(28,21,26,0.7)';
    ctx.beginPath(); ctx.arc(a.center.x, a.center.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this.pal.teamA;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(a.center.x, a.center.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = this.pal.ink;
    ctx.font = '700 18px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(a.label || 'A', a.center.x, a.center.y);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // --- utils ---
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

export const FIELD_INFO = { FIELD, BASE, THROW_LINE_Y, STACK_HEIGHT };
