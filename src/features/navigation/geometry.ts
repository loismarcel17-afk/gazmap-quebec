// Geometry along a route: project a GPS position onto the route line.
//
// Trips to a gas station are short (< ~10 km), so we flatten the Earth around
// the route's start (equirectangular projection): x = east, y = north, in meters.
// Over 10 km the error is a few centimeters, and the math becomes plain 2-D.
import type { LatLng } from "@/features/geo/geo";

const EARTH_RADIUS_METERS = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** [lng, lat], GeoJSON order */
export type Position = [number, number];

interface Point {
  x: number;
  y: number;
}

export interface Line {
  /** Original coordinates [lng, lat] */
  coordinates: Position[];
  points: Point[];
  /** Meters from the start to each point */
  cumulative: number[];
  length: number;
  toPoint: (position: LatLng) => Point;
}

export interface Projection {
  /** Meters from the start of the line to the closest point */
  distanceAlong: number;
  /** Meters between the position and the line */
  distanceFromLine: number;
  /** Index of the segment [i, i + 1] the closest point lies on */
  segmentIndex: number;
}

export function createLine(coordinates: Position[]): Line {
  if (coordinates.length < 2) throw new Error("A route line needs at least 2 points");
  const [lng0, lat0] = coordinates[0];
  const metersPerDegreeLat = toRadians(1) * EARTH_RADIUS_METERS;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos(toRadians(lat0));
  const toPoint = ({ lat, lng }: LatLng): Point => ({
    x: (lng - lng0) * metersPerDegreeLng,
    y: (lat - lat0) * metersPerDegreeLat,
  });

  const points = coordinates.map(([lng, lat]) => toPoint({ lat, lng }));
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return { coordinates, points, cumulative, length: cumulative[cumulative.length - 1], toPoint };
}

/**
 * Closest point of the line to `position`.
 *
 * `previousDistanceAlong` avoids jumping backwards: on a route that comes back
 * near itself (a U-turn, a loop around a block), the closest segment may be one
 * already driven. Segments more than 50 m behind the last known progress are
 * only used if nothing ahead is within 50 m.
 */
export function projectOnLine(line: Line, position: LatLng, previousDistanceAlong = 0): Projection {
  const p = line.toPoint(position);
  let best: Projection | null = null;
  let bestAhead: Projection | null = null;

  for (let i = 0; i < line.points.length - 1; i++) {
    const a = line.points[i];
    const b = line.points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    // t = how far along [a, b] the perpendicular foot falls, clamped to the segment.
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
    const candidate: Projection = {
      distanceAlong: line.cumulative[i] + t * Math.sqrt(lengthSquared),
      distanceFromLine: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)),
      segmentIndex: i,
    };
    if (!best || candidate.distanceFromLine < best.distanceFromLine) best = candidate;
    if (
      candidate.distanceAlong >= previousDistanceAlong - 50 &&
      (!bestAhead || candidate.distanceFromLine < bestAhead.distanceFromLine)
    ) {
      bestAhead = candidate;
    }
  }
  return bestAhead && bestAhead.distanceFromLine <= 50 ? bestAhead : best!;
}

/** Direction of travel at a segment, in degrees clockwise from north (0 = N, 90 = E). */
export function bearingOfSegment(line: Line, segmentIndex: number): number {
  const i = Math.max(0, Math.min(segmentIndex, line.points.length - 2));
  const a = line.points[i];
  const b = line.points[i + 1];
  const degrees = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
  return (degrees + 360) % 360;
}
