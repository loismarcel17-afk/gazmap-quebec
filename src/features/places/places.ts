// Local place search: "Rimouski" or "G5L" → coordinates, built from the station
// data itself. Nothing typed leaves the device and no geocoding API is needed.
// Precision is city / postal-area level, which is enough to find nearby stations.
import type { LatLng } from "@/features/geo/geo";
import type { Station } from "@/features/stations/types";

export interface Place extends LatLng {
  kind: "city" | "postalArea";
  /** Display name: "Rimouski", or "G5L (Rimouski)" for a postal area */
  label: string;
  /** Normalized searchable text */
  key: string;
  stationCount: number;
}

/**
 * Lowercase, no accents, no punctuation, abbreviations expanded:
 * "ST-JÉRÔME" → "saint jerome", "Val-d'Or" → "val d or"
 */
export function normalize(text: string): string {
  return text
    .normalize("NFD") // "é" → "e" + combining accent…
    .replace(/\p{M}/gu, "") // …then drop the accent
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\bste\b/g, "sainte")
    .replace(/\bst\b/g, "saint");
}

const POSTAL_AREA_RE = /^[a-z]\d[a-z]$/;

/** City = text after the last comma of the Régie address: "230 av. Murdoch, Rouyn-Noranda" */
function cityOf(station: Station): string {
  return station.address.slice(station.address.lastIndexOf(",") + 1).trim();
}

interface Group {
  lat: number;
  lng: number;
  count: number;
  /** Spelling → occurrences, to pick the best display name */
  spellings: Map<string, number>;
}

function addTo(groups: Map<string, Group>, key: string, spelling: string, station: Station) {
  const group = groups.get(key) ?? { lat: 0, lng: 0, count: 0, spellings: new Map() };
  group.lat += station.lat;
  group.lng += station.lng;
  group.count += 1;
  group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
  groups.set(key, group);
}

/**
 * Display name: prefer "Montréal" over "MONTRÉAL" and "Saint-Jérôme" over
 * "St-Jérôme", then the most frequent spelling.
 */
function bestSpelling(spellings: Map<string, number>): string {
  const flaws = (spelling: string) =>
    Number(spelling === spelling.toUpperCase()) + Number(/\bste?\b/i.test(spelling));
  const ranked = [...spellings].sort(
    ([a, countA], [b, countB]) => flaws(a) - flaws(b) || countB - countA,
  );
  return ranked[0][0];
}

export function buildPlaceIndex(stations: Station[]): Place[] {
  const cities = new Map<string, Group>();
  const postalAreas = new Map<string, Group>();
  // Most common city per postal area, for labels like "G5L (Rimouski)"
  const areaCities = new Map<string, Map<string, number>>();

  for (const station of stations) {
    const city = cityOf(station);
    const cityKey = normalize(city);
    if (cityKey) addTo(cities, cityKey, city, station);

    // First 3 characters = "forward sortation area", a postal district.
    const area = normalize(station.postalCode.slice(0, 3)).replace(/ /g, "");
    if (POSTAL_AREA_RE.test(area)) {
      addTo(postalAreas, area, area.toUpperCase(), station);
      const counts = areaCities.get(area) ?? new Map<string, number>();
      counts.set(city, (counts.get(city) ?? 0) + 1);
      areaCities.set(area, counts);
    }
  }

  const toPlace = (kind: Place["kind"], key: string, group: Group, label: string): Place => ({
    kind,
    key,
    label,
    lat: group.lat / group.count, // centroid of the area's stations
    lng: group.lng / group.count,
    stationCount: group.count,
  });

  return [
    ...[...cities].map(([key, group]) => toPlace("city", key, group, bestSpelling(group.spellings))),
    ...[...postalAreas].map(([key, group]) =>
      toPlace("postalArea", key, group, `${key.toUpperCase()} (${bestSpelling(areaCities.get(key)!)})`),
    ),
  ];
}

/**
 * Best matches first: exact name, then names starting with the query, then
 * names with a word starting with it ("jerome" finds "Saint-Jérôme").
 * Ties go to places with more stations (bigger towns).
 */
export function searchPlaces(places: Place[], query: string, limit = 6): Place[] {
  let normalized = normalize(query);
  // "G5L 1A1" → "g5l": we only index postal areas.
  const postal = normalized.replace(/ /g, "").match(/^([a-z]\d[a-z])\d?[a-z]?\d?$/);
  if (postal) normalized = postal[1];
  if (normalized.length < 2) return [];

  const score = (place: Place): number => {
    if (place.key === normalized) return 0;
    if (place.key.startsWith(normalized)) return 1;
    if (place.key.includes(` ${normalized}`)) return 2;
    return -1;
  };

  return places
    .map((place) => ({ place, score: score(place) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => a.score - b.score || b.place.stationCount - a.place.stationCount)
    .slice(0, limit)
    .map(({ place }) => place);
}
