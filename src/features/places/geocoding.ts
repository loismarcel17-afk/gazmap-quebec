// Address search for trip planning ("1000 rue Saint-Jean, Québec" → coordinates),
// through Mapbox Geocoding v6. Pure: builds the request and reads the answer;
// the HTTP call lives in /api/adresses (the token stays on the server).
//
// Unlike the local place search (places.ts), what the user types leaves the
// device here: it goes to our server, then to Mapbox. It is never logged nor
// stored, and results are "temporary" geocoding (Mapbox terms: not kept).
import type { LatLng } from "@/features/geo/geo";
import { parsePoint } from "@/features/routing/matrix";

export const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 200;
const MAX_RESULTS = 5;

/** Québec, roughly: results outside are useless (no Régie prices there). */
const QUEBEC_BBOX = "-79.77,44.99,-57.10,62.59";

export interface AddressQuery {
  text: string;
  /** Rank results near this point first (the departure, when known) */
  near: LatLng | null;
}

export interface AddressSuggestion extends LatLng {
  /** "1000 Rue Saint-Jean, Québec, Québec G1R 1R5" */
  label: string;
}

// Street types used in Québec addresses (normalized: lowercase, no accents).
// Words that also start town names are left out: "Côte-Saint-Luc", "St-Jérôme",
// "Place…" must stay free local searches.
const STREET_WORDS = new Set([
  "rue", "boul", "boulevard", "bd", "av", "ave", "avenue", "ch", "chemin", "route", "rte", "rang", "montee",
  "autoroute", "allee", "croissant", "terrasse", "promenade", "impasse", "street", "road", "drive",
]);

/**
 * Does the search text look like a street address ("1000 rue Saint-Jean",
 * "boul. Laurier", "125 Principale")? Then it's worth a (billed) Mapbox search;
 * "Rimouski" or "G5L" are answered by the free local search alone.
 */
export function looksLikeStreetAddress(text: string): boolean {
  const words = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // A civic number: digits, alone or followed by a letter ("1000", "12a"),
  // but not a postal code ("G1R", "H2X 1Y4").
  const civicNumber = words.some((word) => /^\d+[a-z]?$/.test(word));
  return civicNumber || words.some((word) => STREET_WORDS.has(word));
}

export function parseAddressQuery(body: unknown): AddressQuery | null {
  if (typeof body !== "object" || body === null) return null;
  const { q, near } = body as Record<string, unknown>;
  if (typeof q !== "string") return null;
  const text = q.trim().replace(/\s+/g, " ");
  if (text.length < MIN_QUERY_LENGTH || text.length > MAX_QUERY_LENGTH) return null;
  return { text, near: near === undefined || near === null ? null : parsePoint(near) };
}

export function geocodingUrl(query: AddressQuery, token: string): string {
  const params = new URLSearchParams({
    q: query.text,
    country: "ca",
    bbox: QUEBEC_BBOX,
    language: "fr",
    limit: String(MAX_RESULTS),
    autocomplete: "true",
    types: "address,street,neighborhood,locality,place,postcode",
    access_token: token,
  });
  // 2 decimals ≈ 1 km: enough to favor nearby results, no need to send more.
  if (query.near) params.set("proximity", `${query.near.lng.toFixed(2)},${query.near.lat.toFixed(2)}`);
  return `https://api.mapbox.com/search/geocode/v6/forward?${params}`;
}

/** Mapbox answer → suggestions. Malformed features are skipped, not fatal. */
export function parseGeocoding(response: unknown): AddressSuggestion[] {
  const features =
    typeof response === "object" && response !== null ? (response as { features?: unknown }).features : null;
  if (!Array.isArray(features)) throw new Error("Unexpected Geocoding API response");

  return features.flatMap((feature): AddressSuggestion[] => {
    if (typeof feature !== "object" || feature === null) return [];
    const { geometry, properties } = feature as { geometry?: unknown; properties?: unknown };
    const coordinates =
      typeof geometry === "object" && geometry !== null ? (geometry as { coordinates?: unknown }).coordinates : null;
    const position = Array.isArray(coordinates) ? parsePoint({ lng: coordinates[0], lat: coordinates[1] }) : null;
    const props = (typeof properties === "object" && properties !== null ? properties : {}) as Record<string, unknown>;
    // The Québec bounding box also covers parts of Ontario and the Maritimes: keep
    // only addresses Mapbox places in Québec (no Régie prices elsewhere).
    const region = (props.context as { region?: { region_code?: unknown } } | undefined)?.region?.region_code;
    if (region !== undefined && region !== "QC") return [];
    const label =
      typeof props.full_address === "string"
        ? props.full_address
        : [props.name, props.place_formatted].filter((part) => typeof part === "string" && part).join(", ");
    return position && label ? [{ ...position, label }] : [];
  });
}
