import { decodeSnapshot } from "@/features/stations/compact";
import type { StationsSnapshot } from "@/features/stations/types";

/**
 * All stations, in one compressed request to our own /api/stations (cached a
 * minute by the CDN), rather than three requests straight to Supabase.
 */
export const STATIONS_URL = "/api/stations";

/** (Preloaded by the home page: keep this request identical, see src/app/page.tsx.) */
export async function fetchStationsSnapshot(): Promise<StationsSnapshot> {
  const response = await fetch(STATIONS_URL);
  if (!response.ok) throw new Error(`/api/stations answered HTTP ${response.status}`);
  return decodeSnapshot(await response.json());
}
