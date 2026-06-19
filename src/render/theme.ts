// Retro neighborhood backdrop, pre-rendered ONCE to an offscreen canvas and then
// blitted each frame (cheap). 1990s Eastern-European courtyard at golden hour:
// concrete + dust, balconies, a carpet-beating rack, a boxy parked car, chalk.
import { BASE, FIELD, THROW_LINE_Y } from '../sim/config';
import type { Palette } from './palette';

export class Theme {
  readonly canvas: HTMLCanvasElement;
  private built = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = FIELD.w;
    this.canvas.height = FIELD.h;
  }

  ensure(pal: Palette, key: string): void {
    if (this.built === key) return;
    this.built = key;
    const ctx = this.canvas.getContext('2d')!;
    this.paint(ctx, pal);
  }

  private paint(ctx: CanvasRenderingContext2D, pal: Palette): void {
    const W = FIELD.w, H = FIELD.h;
    ctx.clearRect(0, 0, W, H);

    // --- dusk sky behind the block ---
    const horizon = 250;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(1, pal.skyDusk);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);

    // --- apartment block facade with balconies ---
    ctx.fillStyle = pal.building;
    ctx.fillRect(0, 60, W, horizon - 60);
    ctx.fillStyle = pal.buildingShade;
    ctx.fillRect(0, 60, W, 10);
    // balcony grid
    for (let by = 84; by < horizon - 26; by += 56) {
      for (let bx = 18; bx < W - 40; bx += 92) {
        // window
        ctx.fillStyle = (bx + by) % 3 === 0 ? pal.windowLit : pal.window;
        ctx.fillRect(bx, by, 40, 30);
        // balcony rail
        ctx.fillStyle = pal.balcony;
        ctx.fillRect(bx - 4, by + 30, 48, 8);
        ctx.fillStyle = pal.buildingShade;
        for (let rx = bx - 2; rx < bx + 44; rx += 7) ctx.fillRect(rx, by + 22, 2, 16);
      }
    }

    // --- asphalt courtyard ---
    const ground = ctx.createLinearGradient(0, horizon, 0, H);
    ground.addColorStop(0, pal.asphalt);
    ground.addColorStop(1, pal.asphalt2);
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, W, H - horizon);
    // patchy concrete blotches
    let s = 99;
    const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = horizon + rnd() * (H - horizon), r = 8 + rnd() * 30;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    // expansion-joint cracks
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 2;
    for (let y = horizon + 70; y < H; y += 150) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + (rnd() - 0.5) * 30); ctx.stroke();
    }

    // --- chalk court markings ---
    ctx.strokeStyle = pal.chalk;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.strokeRect(22, horizon + 8, W - 44, H - horizon - 70);
    // base circle (the castle's spot)
    ctx.beginPath(); ctx.arc(BASE.x, BASE.y, 54, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.32;
    ctx.beginPath(); ctx.arc(BASE.x, BASE.y, 40, 0, Math.PI * 2); ctx.stroke();
    // throw line (dashed)
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([16, 12]);
    ctx.beginPath(); ctx.moveTo(28, THROW_LINE_Y); ctx.lineTo(W - 28, THROW_LINE_Y); ctx.stroke();
    ctx.setLineDash([]);
    // hopscotch near the bottom corner
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) ctx.strokeRect(60, H - 130 + i * 22, 40, 22);
    ctx.globalAlpha = 1;

    // --- carpet-beating rack (bătătorul) on the left ---
    this.drawRack(ctx, pal, 70, horizon + 70);
    // --- boxy parked car (Dacia-ish) top right along the block ---
    this.drawCar(ctx, pal, W - 132, horizon - 6);

    // --- dust grain ---
    ctx.globalAlpha = 1;
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * W, y = rnd() * H;
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,240,210,0.035)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // vignette
    const vig = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  private drawRack(ctx: CanvasRenderingContext2D, pal: Palette, x: number, y: number): void {
    ctx.fillStyle = pal.rack;
    ctx.fillRect(x - 4, y, 7, 120);          // left post
    ctx.fillRect(x + 74, y, 7, 120);         // right post
    ctx.fillRect(x - 4, y, 85, 8);           // top bar
    // a draped carpet
    const g = ctx.createLinearGradient(x, y + 10, x, y + 96);
    g.addColorStop(0, '#9c4f3f');
    g.addColorStop(1, '#7a3a2f');
    ctx.fillStyle = g;
    ctx.fillRect(x + 6, y + 10, 64, 78);
    ctx.fillStyle = 'rgba(240,210,170,0.5)';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 8, y + 22 + i * 18, 60, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 6, y + 84, 64, 4);
  }

  private drawCar(ctx: CanvasRenderingContext2D, pal: Palette, x: number, y: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 4, y + 44, 124, 10); // ground shadow
    ctx.fillStyle = pal.carBody;
    ctx.fillRect(x, y + 8, 116, 38);      // lower body (boxy)
    ctx.fillRect(x + 18, y - 14, 80, 26); // cabin
    ctx.fillStyle = pal.carShade;
    ctx.fillRect(x, y + 38, 116, 8);
    ctx.fillStyle = pal.carGlass;
    ctx.fillRect(x + 24, y - 9, 32, 18);  // windows
    ctx.fillRect(x + 60, y - 9, 32, 18);
    ctx.fillStyle = '#1d1a18';
    ctx.beginPath(); ctx.arc(x + 26, y + 48, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 92, y + 48, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2d27a';
    ctx.fillRect(x + 112, y + 16, 5, 8); // headlight
  }
}
