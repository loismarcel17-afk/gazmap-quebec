export const FUEL_TYPES = ["regular", "premium", "diesel"] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

/** Price in tenths of a cent per litre (1859 = 185.9 ¢/L), or null when not sold / unknown. */
export type PriceTenths = number | null;

export interface Station {
  id: string;
  name: string | null;
  brand: string | null;
  address: string;
  region: string;
  postalCode: string;
  lat: number;
  lng: number;
  prices: Record<FuelType, PriceTenths>;
  /** Paid placement: labeled in the UI, never changes the ranking (CLAUDE.md). */
  sponsored?: boolean;
}

/** All stations and the time of the Régie publication they come from. */
export interface StationsSnapshot {
  /** ISO 8601 time of the Régie export */
  updatedAt: string;
  stations: Station[];
}
