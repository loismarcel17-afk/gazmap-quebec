// Demo route in downtown Montréal, shaped exactly like a Mapbox Directions
// response (driving-traffic, steps, voice + banner instructions, geojson).
//
// SYNTHETIC: built with geometry, not fetched from Mapbox (no token in this
// project yet). Street names are real, positions approximate:
//   start → 600 m along rue Sainte-Catherine Est (heading 60°, Montréal's "east")
//         → turn left → 400 m along boulevard Saint-Laurent (heading 330°) → station.
import { destination, type LatLng } from "@/features/geo/geo";
import type { Position } from "../geometry";

export const START: LatLng = { lat: 45.5065, lng: -73.5686 };
const FIRST_LEG = { meters: 600, bearing: 60 };
const SECOND_LEG = { meters: 400, bearing: 330 };
export const TURN: LatLng = destination(START, FIRST_LEG.meters, FIRST_LEG.bearing);
export const STATION: LatLng = destination(TURN, SECOND_LEG.meters, SECOND_LEG.bearing);
export const ROUTE_LENGTH = FIRST_LEG.meters + SECOND_LEG.meters;

/**
 * Point `meters` along the route, optionally `offsetMeters` to the right of it
 * (negative = left): simulates a GPS position on or off the route.
 */
export function pointAlong(meters: number, offsetMeters = 0): LatLng {
  const onFirstLeg = meters <= FIRST_LEG.meters;
  const bearing = onFirstLeg ? FIRST_LEG.bearing : SECOND_LEG.bearing;
  const onRoute = onFirstLeg
    ? destination(START, meters, FIRST_LEG.bearing)
    : destination(TURN, meters - FIRST_LEG.meters, SECOND_LEG.bearing);
  return offsetMeters === 0 ? onRoute : destination(onRoute, Math.abs(offsetMeters), bearing + (offsetMeters > 0 ? 90 : -90));
}

/** Route vertices every 50 m, like a real geometry. */
function coordinates(): Position[] {
  const points: Position[] = [];
  for (let m = 0; m <= ROUTE_LENGTH; m += 50) {
    const { lat, lng } = pointAlong(m);
    points.push([lng, lat]);
  }
  return points;
}

const TURN_LEFT = "tournez à gauche sur Boulevard Saint-Laurent";

export const MONTREAL_DIRECTIONS_RESPONSE = {
  code: "Ok",
  uuid: "demo",
  waypoints: [
    { name: "Rue Sainte-Catherine Est", location: [START.lng, START.lat] },
    { name: "Boulevard Saint-Laurent", location: [STATION.lng, STATION.lat] },
  ],
  routes: [
    {
      distance: ROUTE_LENGTH,
      duration: 132,
      weight: 140,
      geometry: { type: "LineString", coordinates: coordinates() },
      legs: [
        {
          distance: ROUTE_LENGTH,
          duration: 132,
          summary: "Rue Sainte-Catherine Est, Boulevard Saint-Laurent",
          steps: [
            {
              distance: 600,
              duration: 72,
              name: "Rue Sainte-Catherine Est",
              maneuver: { type: "depart", bearing_after: 60, location: [START.lng, START.lat] },
              voiceInstructions: [
                {
                  distanceAlongGeometry: 600,
                  announcement: `Roulez vers l'est sur Rue Sainte-Catherine Est. Dans 600 mètres, ${TURN_LEFT}.`,
                  ssmlAnnouncement: "<speak>…</speak>",
                },
                { distanceAlongGeometry: 200, announcement: `Dans 200 mètres, ${TURN_LEFT}.` },
                { distanceAlongGeometry: 40, announcement: "Tournez à gauche sur Boulevard Saint-Laurent." },
              ],
              bannerInstructions: [
                {
                  distanceAlongGeometry: 600,
                  primary: { text: "Boulevard Saint-Laurent", type: "turn", modifier: "left", components: [] },
                },
              ],
            },
            {
              distance: 400,
              duration: 60,
              name: "Boulevard Saint-Laurent",
              maneuver: { type: "turn", modifier: "left", location: [TURN.lng, TURN.lat] },
              voiceInstructions: [
                { distanceAlongGeometry: 400, announcement: "Continuez sur Boulevard Saint-Laurent sur 400 mètres." },
                { distanceAlongGeometry: 80, announcement: "Votre destination se trouve sur la droite." },
              ],
              bannerInstructions: [
                {
                  distanceAlongGeometry: 400,
                  primary: { text: "Votre destination", type: "arrive", modifier: "right", components: [] },
                },
              ],
            },
            {
              distance: 0,
              duration: 0,
              name: "Boulevard Saint-Laurent",
              maneuver: { type: "arrive", modifier: "right", location: [STATION.lng, STATION.lat] },
              voiceInstructions: [],
              bannerInstructions: [],
            },
          ],
        },
      ],
    },
  ],
};
