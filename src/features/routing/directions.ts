// Mapbox Directions API: build the request, keep only what guidance needs.
// Pure; the HTTP call lives in the /api/itineraire route.
import type { LatLng } from "@/features/geo/geo";
import type { Position } from "@/features/navigation/geometry";

export interface Maneuver {
  /** Mapbox maneuver type: depart, turn, merge, roundabout, arrive… */
  type: string;
  /** left, slight right, uturn…; null when not applicable */
  modifier: string | null;
}

export interface VoiceInstruction {
  /** Speak when the next maneuver is this many meters ahead */
  distanceAlongGeometry: number;
  announcement: string;
}

export interface RouteStep {
  distanceMeters: number;
  durationSeconds: number;
  /** Maneuver at the START of this step (e.g. the turn onto this street) */
  maneuver: Maneuver;
  /** Street driven during this step */
  name: string;
  /** Banner for the maneuver at the END of this step: text, icon */
  banner: { text: string; maneuver: Maneuver } | null;
  /** Announcements for the maneuver at the END of this step */
  voice: VoiceInstruction[];
}

export interface Route {
  /** Full route line, [lng, lat] */
  geometry: Position[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
}

export function directionsUrl(origin: LatLng, destination: LatLng, token: string, headingDegrees?: number): string {
  const point = ({ lat, lng }: LatLng) => `${lng.toFixed(5)},${lat.toFixed(5)}`;
  const params = new URLSearchParams({
    steps: "true",
    voice_instructions: "true",
    banner_instructions: "true",
    language: "fr",
    // Without it, Mapbox speaks in miles ("dans un quart de mile"), even in French.
    voice_units: "metric",
    geometries: "geojson",
    overview: "full",
    access_token: token,
  });
  // When rerouting while driving: start in the current direction of travel
  // (±45°) instead of proposing a U-turn. ";" = no constraint at the destination.
  if (headingDegrees !== undefined) params.set("bearings", `${Math.round(headingDegrees)},45;`);
  return `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${point(origin)};${point(destination)}?${params}`;
}

/** Mapbox response → Route, or throws if it isn't a usable route. */
export function parseDirections(response: unknown): Route {
  const body = asObject(response);
  if (body?.code !== "Ok" || !Array.isArray(body.routes) || body.routes.length === 0) {
    throw new Error(`Directions API: no route (${String(body?.code)})`);
  }
  const route = asObject(body.routes[0]);
  const geometry = asObject(route?.geometry)?.coordinates;
  const leg = Array.isArray(route?.legs) ? asObject(route.legs[0]) : null;
  if (!route || !isPositionList(geometry) || !leg || !Array.isArray(leg.steps)) {
    throw new Error("Directions API: unexpected route shape");
  }

  return {
    geometry,
    distanceMeters: number(route.distance),
    durationSeconds: number(route.duration),
    steps: leg.steps.map((raw) => {
      const step = asObject(raw) ?? {};
      const banner = Array.isArray(step.bannerInstructions) ? asObject(step.bannerInstructions[0]) : null;
      const primary = asObject(banner?.primary);
      return {
        distanceMeters: number(step.distance),
        durationSeconds: number(step.duration),
        maneuver: maneuver(step.maneuver),
        name: typeof step.name === "string" ? step.name : "",
        banner: primary ? { text: String(primary.text ?? ""), maneuver: maneuver(primary) } : null,
        voice: (Array.isArray(step.voiceInstructions) ? step.voiceInstructions : [])
          .map(asObject)
          .filter((v): v is Record<string, unknown> => v !== null && typeof v.announcement === "string")
          .map((v) => ({ distanceAlongGeometry: number(v.distanceAlongGeometry), announcement: String(v.announcement) })),
      };
    }),
  };
}

function maneuver(value: unknown): Maneuver {
  const raw = asObject(value);
  return {
    type: typeof raw?.type === "string" ? raw.type : "continue",
    modifier: typeof raw?.modifier === "string" ? raw.modifier : null,
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isPositionList(value: unknown): value is Position[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
  );
}
