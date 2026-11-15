// Fewer points, same shape: Ramer–Douglas–Peucker simplification of a route line.
//
// Mapbox's own "simplified" overview is made for drawing a whole country: on a
// 250 km trip it keeps ~15 points, and the line cuts corners by several km, so
// stations right on the highway fall out of the 3 km corridor. We ask for the
// full line (thousands of points) and simplify it here with a tolerance of
// 50 m: a few hundred points, never more than 50 m from the real road.
import type { Position } from "@/features/navigation/geometry";

export const SIMPLIFY_TOLERANCE_METERS = 50;

const METERS_PER_DEGREE = 111_320;

/**
 * Keeps the first and last points, then recursively the point farthest from
 * the chord between them, as long as it is farther than `toleranceMeters`.
 * Iterative (explicit stack): a 5 000-point line must not overflow the call stack.
 */
export function simplifyLine(line: Position[], toleranceMeters = SIMPLIFY_TOLERANCE_METERS): Position[] {
  if (line.length <= 2) return line;
  // Flat projection around the line's middle latitude: fine for corridor checks.
  const midLat = (line[0][1] + line[line.length - 1][1]) / 2;
  const lngScale = METERS_PER_DEGREE * Math.cos((midLat * Math.PI) / 180);
  const xy = line.map(([lng, lat]) => [lng * lngScale, lat * METERS_PER_DEGREE] as const);

  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let farthest = -1;
    let farthestDistance = toleranceMeters;
    for (let i = first + 1; i < last; i++) {
      const distance = distanceToSegment(xy[i], xy[first], xy[last]);
      if (distance > farthestDistance) {
        farthest = i;
        farthestDistance = distance;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return line.filter((_, i) => keep[i] === 1);
}

function distanceToSegment(
  [px, py]: readonly [number, number],
  [ax, ay]: readonly [number, number],
  [bx, by]: readonly [number, number],
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
