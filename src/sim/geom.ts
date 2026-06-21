// Tiny collision helpers shared by the sim (step.ts) and setup (state.ts).
// Pure, allocation-light, no DOM/render access.
import type { Obstacle } from './config';

/** If the circle (cx,cy,r) overlaps the obstacle footprint, return the position
 * pushed out to the nearest edge (axis of least penetration) so the mover slides
 * along it; otherwise null. Treats the box as inflated by r, so it's a point-vs-
 * rect test on the circle center — cheap and robust for axis-aligned boxes. */
export function resolveCircleAabb(
  cx: number, cy: number, r: number, o: Obstacle,
): { x: number; y: number } | null {
  const minX = o.x - r, maxX = o.x + o.w + r;
  const minY = o.y - r, maxY = o.y + o.h + r;
  if (cx <= minX || cx >= maxX || cy <= minY || cy >= maxY) return null;
  const pLeft = cx - minX, pRight = maxX - cx, pTop = cy - minY, pBottom = maxY - cy;
  const m = Math.min(pLeft, pRight, pTop, pBottom);
  if (m === pLeft) return { x: minX, y: cy };
  if (m === pRight) return { x: maxX, y: cy };
  if (m === pTop) return { x: cx, y: minY };
  return { x: cx, y: maxY };
}

/** Does the segment p0->p1 enter the obstacle footprint inflated by `pad`? Returns
 * the entry point, or null. Liang–Barsky slab clip — swept so a fast ball can't
 * tunnel through a thin box in one tick. */
export function segmentHitsAabb(
  x0: number, y0: number, x1: number, y1: number, o: Obstacle, pad: number,
): { x: number; y: number } | null {
  const minX = o.x - pad, maxX = o.x + o.w + pad;
  const minY = o.y - pad, maxY = o.y + o.h + pad;
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const edges: ReadonlyArray<readonly [number, number]> = [
    [-dx, x0 - minX], [dx, maxX - x0], [-dy, y0 - minY], [dy, maxY - y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null; // parallel and outside this slab
    } else {
      const t = q / p;
      if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
      else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
  }
  return { x: x0 + dx * t0, y: y0 + dy * t0 };
}

/** Push a point out of any obstacle footprint (inflated by r). Mutates nothing;
 * returns the corrected position. Used for spawn/scatter so nothing lands trapped. */
export function pushOutOfObstacles(
  x: number, y: number, r: number, obstacles: readonly Obstacle[],
): { x: number; y: number } {
  let px = x, py = y;
  for (const o of obstacles) {
    const f = resolveCircleAabb(px, py, r, o);
    if (f) { px = f.x; py = f.y; }
  }
  return { x: px, y: py };
}
