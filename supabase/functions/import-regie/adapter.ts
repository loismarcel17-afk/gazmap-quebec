// Adapter: Régie de l'énergie exports → normalized stations.
//
// This is the ONLY file that knows the Régie's field names and value formats.
// Two formats are supported:
//   - the GeoJSON feed behind regieessencequebec.ca (used by the importer),
//   - the Excel export offered for download (manual imports, kept as a fallback).
// If a format changes, fix it here. Pure TypeScript with no imports so it runs
// unchanged in Node, the browser and Deno (Supabase Edge Functions).

export type FuelKey = "regular" | "premium" | "diesel";

export interface RegieStation {
  id: string;
  name: string | null;
  brand: string | null;
  address: string;
  region: string;
  postalCode: string;
  lat: number;
  lng: number;
  /** "En opération"…; null when the source doesn't say (Excel) */
  status: string | null;
  prices: Record<FuelKey, number | null>;
}

export interface RegieParseResult {
  stations: RegieStation[];
  /** Human-readable problems (where + reason) — entries are skipped or values nulled, never guessed. */
  issues: string[];
}

export interface RegieFeedResult extends RegieParseResult {
  /** ISO 8601 time the Régie generated the feed */
  publishedAt: string;
}

// Generous box around Québec: catches swapped or garbage coordinates like (0, 0).
const BOUNDS = { minLat: 44, maxLat: 63, minLng: -80, maxLng: -57 };

// Prices outside 50–500 ¢/L are almost certainly typos.
const MIN_PRICE_TENTHS = 500;
const MAX_PRICE_TENTHS = 5000;

const NOT_AVAILABLE = new Set(["", "N/D", "ND", "-"]);

// ---------------------------------------------------------------------------
// GeoJSON feed: https://regieessencequebec.ca/stations.geojson.gz
// { type: "FeatureCollection", metadata: { generated_at, … }, features: [
//   { geometry: { type: "Point", coordinates: [lng, lat] },
//     properties: { Name, brand, Status, Address, PostalCode, Region,
//                   Prices: [{ GasType: "Régulier", Price: "199.4¢", IsAvailable: true }, …] } } ] }

const GAS_TYPES: Record<string, FuelKey> = {
  Régulier: "regular",
  Super: "premium",
  Diesel: "diesel",
};

export function parseRegieGeoJson(data: unknown): RegieFeedResult {
  // The feed comes from outside: check its shape instead of trusting it.
  if (!isObject(data) || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("Régie feed: not a GeoJSON FeatureCollection");
  }
  const generatedAt = isObject(data.metadata) ? data.metadata.generated_at : undefined;
  if (typeof generatedAt !== "string" || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("Régie feed: metadata.generated_at missing or invalid");
  }

  const collector = createCollector();

  data.features.forEach((feature: unknown, index: number) => {
    const where = `feature ${index}`;
    const properties = isObject(feature) && isObject(feature.properties) ? feature.properties : null;
    const coordinates =
      isObject(feature) && isObject(feature.geometry) && Array.isArray(feature.geometry.coordinates)
        ? feature.geometry.coordinates
        : null;
    if (!properties || !coordinates) {
      collector.issues.push(`${where}: missing geometry or properties`);
      return;
    }

    const prices: Record<FuelKey, number | null> = { regular: null, premium: null, diesel: null };
    const list = Array.isArray(properties.Prices) ? properties.Prices : [];
    for (const entry of list) {
      if (!isObject(entry)) continue;
      const fuel = GAS_TYPES[String(entry.GasType)];
      if (!fuel) {
        collector.issues.push(`${where}: unknown GasType "${String(entry.GasType)}"`);
        continue;
      }
      if (entry.IsAvailable !== true) continue; // not sold right now → stays null
      const parsed = parsePriceTenths(String(entry.Price ?? ""));
      if (parsed === undefined) collector.issues.push(`${where}: unreadable ${fuel} price "${String(entry.Price)}"`);
      prices[fuel] = parsed ?? null;
    }
    // A fuel absent from the list (e.g. no diesel) is simply not sold: null.

    collector.add(where, {
      name: text(properties.Name),
      brand: text(properties.brand),
      address: text(properties.Address),
      region: text(properties.Region),
      postalCode: text(properties.PostalCode),
      lat: Number(coordinates[1]), // GeoJSON order is [longitude, latitude]
      lng: Number(coordinates[0]),
      status: text(properties.Status) || null,
      prices,
    });
  });

  return { ...collector.result(), publishedAt: new Date(generatedAt).toISOString() };
}

// ---------------------------------------------------------------------------
// Excel export (rows of strings from xlsx.ts)

const COLUMNS = {
  name: "Nom",
  brand: "Bannière",
  address: "Adresse",
  region: "Région",
  postalCode: "Code Postal",
  lat: "Latitude",
  lng: "Longitude",
  regular: "Prix Régulier",
  premium: "Prix Super",
  diesel: "Prix Diesel",
} as const;

type ColumnKey = keyof typeof COLUMNS;

export function parseRegieRows(rows: string[][]): RegieParseResult {
  const [header, ...body] = rows;
  if (!header) throw new Error("Régie export is empty");
  const columns = locateColumns(header);
  const collector = createCollector();

  body.forEach((row, index) => {
    const where = `row ${index + 2}`; // 1-based, after the header — matches Excel
    const cell = (key: ColumnKey) => (row[columns[key]] ?? "").trim();
    if (row.every((value) => value.trim() === "")) return;

    const price = (key: FuelKey) => {
      const parsed = parsePriceTenths(cell(key));
      if (parsed === undefined) collector.issues.push(`${where}: unreadable ${COLUMNS[key]} "${cell(key)}"`);
      return parsed ?? null;
    };

    collector.add(where, {
      name: cell("name") || null,
      brand: cell("brand") || null,
      address: cell("address"),
      region: cell("region"),
      postalCode: cell("postalCode"),
      // Empty cells must not become 0: Number("") === 0 would pass for a coordinate.
      lat: cell("lat") ? Number(cell("lat")) : NaN,
      lng: cell("lng") ? Number(cell("lng")) : NaN,
      status: null,
      prices: { regular: price("regular"), premium: price("premium"), diesel: price("diesel") },
    });
  });

  return collector.result();
}

function locateColumns(header: string[]): Record<ColumnKey, number> {
  // Find columns by name, not position, so a reordered export still works.
  const normalized = header.map((title) => title.trim().toLowerCase());
  const entries = (Object.keys(COLUMNS) as ColumnKey[]).map((key) => {
    const index = normalized.indexOf(COLUMNS[key].toLowerCase());
    if (index === -1) throw new Error(`Régie export: column "${COLUMNS[key]}" not found`);
    return [key, index] as const;
  });
  return Object.fromEntries(entries) as Record<ColumnKey, number>;
}

// ---------------------------------------------------------------------------
// Shared rules, so both formats produce identical stations (and identical ids).

/**
 * "185.9¢" → 1859, "N/D" → null, garbage → undefined.
 *
 * Works on the digits as text instead of parseFloat("185.9") * 10, which gives
 * 1859.0000000000002: floating point cannot represent 185.9 exactly.
 */
export function parsePriceTenths(raw: string): number | null | undefined {
  const value = raw.trim();
  if (NOT_AVAILABLE.has(value.toUpperCase())) return null;

  const match = value.match(/^(\d{1,3})(?:[.,](\d))?\s*¢?$/);
  if (!match) return undefined;

  const tenths = Number(match[1]) * 10 + Number(match[2] ?? "0");
  if (tenths < MIN_PRICE_TENTHS || tenths > MAX_PRICE_TENTHS) return undefined;
  return tenths;
}

function createCollector() {
  const stations: RegieStation[] = [];
  const issues: string[] = [];
  const seenIds = new Map<string, number>();

  return {
    issues,
    add(where: string, station: Omit<RegieStation, "id">) {
      if (!isInQuebec(station.lat, station.lng)) {
        issues.push(`${where}: missing or invalid coordinates (${station.lat}, ${station.lng})`);
        return;
      }
      // The Régie has no station id: derive a stable one from what identifies a station.
      const baseId = hashId(`${station.name ?? ""}|${station.address}|${station.postalCode}`);
      const duplicates = seenIds.get(baseId) ?? 0;
      seenIds.set(baseId, duplicates + 1);
      stations.push({ id: duplicates === 0 ? baseId : `${baseId}-${duplicates + 1}`, ...station });
    },
    result: (): RegieParseResult => ({ stations, issues }),
  };
}

function isInQuebec(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BOUNDS.minLat &&
    lat <= BOUNDS.maxLat &&
    lng >= BOUNDS.minLng &&
    lng <= BOUNDS.maxLng
  );
}

/** FNV-1a 32-bit hash, base 36: short, deterministic, no crypto dependency. */
function hashId(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
