// Fixed camera (world == internal resolution). Adds a little screen shake for
// juice on topples and tags. Renderer applies the offset; the sim never sees it.
export class Camera {
  offsetX = 0;
  offsetY = 0;
  private shake = 0;
  private seed = 1234;

  addShake(mag: number): void {
    this.shake = Math.min(16, this.shake + mag);
  }

  update(dt: number): void {
    if (this.shake <= 0.01) { this.shake = 0; this.offsetX = 0; this.offsetY = 0; return; }
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) & 0x7fffffff;
    const a = (this.seed / 0x7fffffff) * Math.PI * 2;
    this.offsetX = Math.cos(a) * this.shake;
    this.offsetY = Math.sin(a) * this.shake;
    this.shake = Math.max(0, this.shake - dt * 48);
  }
}
