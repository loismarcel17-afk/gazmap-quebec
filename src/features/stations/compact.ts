// Compact wire format for the full station list (/api/stations): one array per
// station instead of an object repeating 13 key names 2 500 times. With gzip on
// top, the home page downloads ~5× less before it can show prices.
import type { StationSelectRow } from "./rows";
import type { Station, StationsSnapshot } from "./types";

export const COMPACT_VERSION = 1;

/** [id, name, brand, address, region, postalCode, lat, lng, regular, premium, diesel, sponsored (0/1)] */
export type CompactStation = [
  string,
  string | null,
  string | null,
  string,
  string,
  string,
  number,
  number,
  number | null,
  number | null,
  number | null,
  0 | 1,
];

export interface CompactSnapshot {
  v: typeof COMPACT_VERSION;
  updatedAt: string;
  stations: CompactStation[];
}

/** 5 decimals ≈ 1 m: plenty for a station, and shorter than the 14 digits Postgres returns. */
const round5 = (degrees: number) => Math.round(degrees * 1e5) / 1e5;

export function encodeSnapshot(rows: StationSelectRow[]): CompactSnapshot {
  let updatedAt = "";
  for (const row of rows) {
    // Most recent Régie publication; compare real times (offsets vary).
    if (!updatedAt || Date.parse(row.prices_updated_at) > Date.parse(updatedAt)) updatedAt = row.prices_updated_at;
  }
  return {
    v: COMPACT_VERSION,
    updatedAt,
    stations: rows.map((row) => [
      row.id,
      row.name,
      row.brand,
      row.address,
      row.region,
      row.postal_code,
      round5(row.lat),
      round5(row.lng),
      row.price_regular,
      row.price_premium,
      row.price_diesel,
      row.sponsored ? 1 : 0,
    ]),
  };
}

/** Back to the app's shape. Throws on anything that isn't this format (e.g. an old cached response). */
export function decodeSnapshot(data: unknown): StationsSnapshot {
  const snapshot = data as Partial<CompactSnapshot> | null;
  if (snapshot?.v !== COMPACT_VERSION || typeof snapshot.updatedAt !== "string" || !Array.isArray(snapshot.stations)) {
    throw new Error("Unexpected station list format");
  }
  return {
    updatedAt: snapshot.updatedAt,
    stations: snapshot.stations.map(
      ([id, name, brand, address, region, postalCode, lat, lng, regular, premium, diesel, sponsored]): Station => ({
        id,
        name,
        brand,
        address,
        region,
        postalCode,
        lat,
        lng,
        prices: { regular, premium, diesel },
        sponsored: sponsored === 1,
      }),
    ),
  };
}
