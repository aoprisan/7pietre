// Optional sprite art for the moving game objects (players, ball, stones). Each
// image is loaded lazily from ./art/sprites/<name>.webp; until it finishes loading
// — or if the file is absent — the getter returns null and the renderer falls back
// to its procedural canvas shapes. Mirrors Theme's backdrop loading so art can be
// added incrementally and the Node render-smoke harness (no `Image`) stays
// procedural.
const STONE_SPRITE_COUNT = 8;

export class Sprites {
  private images: Record<string, HTMLImageElement> = {};
  private requested = new Set<string>();

  /** Returns the loaded image, or null while it loads / if it failed. */
  private get(name: string): HTMLImageElement | null {
    this.request(name);
    const img = this.images[name];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }

  private request(name: string): void {
    if (this.requested.has(name)) return;
    if (typeof Image === 'undefined') return; // Node smoke harness: stay procedural
    this.requested.add(name);
    const img = new Image();
    img.onload = () => { this.images[name] = img; };
    img.onerror = () => { /* no sprite: keep the procedural shape */ };
    img.src = `./art/sprites/${name}.webp`;
  }

  player(team: 'A' | 'B'): HTMLImageElement | null {
    return this.get(team === 'A' ? 'player-a' : 'player-b');
  }

  ball(): HTMLImageElement | null {
    return this.get('ball');
  }

  /** Stone sprites are cycled by index for variety, like STONE_COLORS. */
  stone(i: number): HTMLImageElement | null {
    const n = ((i % STONE_SPRITE_COUNT) + STONE_SPRITE_COUNT) % STONE_SPRITE_COUNT;
    return this.get(`stone-${n}`);
  }
}
