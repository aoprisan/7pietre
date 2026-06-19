// Seeded, deterministic RNG (mulberry32). The simulation threads its state on
// GameState so a given seed + intent stream always reproduces the same round.
export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: t >>> 0 };
}

/** Convenience stateful wrapper — used by bot controllers (outside the sim). */
export class RNG {
  state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    const r = nextRandom(this.state);
    this.state = r.state;
    return r.value;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  /** Symmetric noise in [-mag, mag]. */
  noise(mag: number): number {
    return (this.next() * 2 - 1) * mag;
  }
}

/** Roll against an object that carries a numeric `rng` field (e.g. GameState).
 *  Mutates the field — this is how the sim stays deterministic and serialisable. */
export function rollFloat(holder: { rng: number }): number {
  const r = nextRandom(holder.rng);
  holder.rng = r.state;
  return r.value;
}
export function rollRange(holder: { rng: number }, lo: number, hi: number): number {
  return lo + (hi - lo) * rollFloat(holder);
}

export function hashSeed(...parts: number[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
