import type { Database } from "@/lib/database.types";
import type { Station, StationsSnapshot } from "./types";

type StationRow = Database["public"]["Tables"]["stations"]["Row"];

/** Columns the app needs: only these are downloaded. */
export const STATION_COLUMNS =
  "id, name, brand, address, region, postal_code, lat, lng, price_regular, price_premium, price_diesel, prices_updated_at, sponsored";

export type StationSelectRow = Pick<
  StationRow,
  | "id"
  | "name"
  | "brand"
  | "address"
  | "region"
  | "postal_code"
  | "lat"
  | "lng"
  | "price_regular"
  | "price_premium"
  | "price_diesel"
  | "prices_updated_at"
  | "sponsored"
>;

/** Database row (snake_case, flat prices) → app Station. */
export function stationFromRow(row: StationSelectRow): Station {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    address: row.address,
    region: row.region,
    postalCode: row.postal_code,
    lat: row.lat,
    lng: row.lng,
    prices: { regular: row.price_regular, premium: row.price_premium, diesel: row.price_diesel },
    sponsored: row.sponsored,
  };
}

/** Rows → snapshot; updatedAt = the most recent Régie publication among the stations. */
export function snapshotFromRows(rows: StationSelectRow[]): StationsSnapshot {
  let updatedAt = "";
  for (const row of rows) {
    // ISO strings with the same format compare correctly as text… but the
    // database returns "+00:00" offsets, so compare real times.
    if (!updatedAt || Date.parse(row.prices_updated_at) > Date.parse(updatedAt)) {
      updatedAt = row.prices_updated_at;
    }
  }
  return { updatedAt, stations: rows.map(stationFromRow) };
}
