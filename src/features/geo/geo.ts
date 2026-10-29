export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * Straight-line ("as the crow flies") distance in meters, using the haversine
 * formula, which accounts for the Earth being a sphere. Road distance is
 * longer; real routes come in PLAN.md task 8.
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** Point reached by going `meters` from `origin` in direction `bearingDegrees` (0 = north). */
export function destination(origin: LatLng, meters: number, bearingDegrees: number): LatLng {
  const angular = meters / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(origin.lat);
  const lng1 = toRadians(origin.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDegrees(lat2), lng: toDegrees(lng2) };
}

/** Circle as a closed ring of [lng, lat] points (GeoJSON order), for drawing the search radius. */
export function circleRing(center: LatLng, meters: number, steps = 64): [number, number][] {
  const ring = Array.from({ length: steps }, (_, i) => {
    const point = destination(center, meters, (i * 360) / steps);
    return [point.lng, point.lat] as [number, number];
  });
  ring.push(ring[0]); // a GeoJSON ring ends where it starts
  return ring;
}

/** Bounding box of the circle: [[west, south], [east, north]] */
export function boundsAround(center: LatLng, meters: number): [[number, number], [number, number]] {
  const north = destination(center, meters, 0).lat;
  const south = destination(center, meters, 180).lat;
  const east = destination(center, meters, 90).lng;
  const west = destination(center, meters, 270).lng;
  return [
    [west, south],
    [east, north],
  ];
}
