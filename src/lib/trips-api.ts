import type { FuelType } from "@/features/stations/types";
import { supabase } from "./supabase";

export type TripMode = "guidance" | "external";
export type TripStatus = "started" | "arrived" | "cancelled";

/**
 * Records a trip for the signed-in user ("J'y vais"). Returns its id, or null
 * when there's nothing to record (no account, terms not accepted, offline…).
 * Never throws: recording history must never block someone from leaving.
 * No position is sent: only the station and the fuel.
 */
export async function startTrip(stationId: string, fuel: FuelType, mode: TripMode): Promise<string | null> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return null; // no account: nothing is stored
    const { data, error } = await supabase
      .from("trips")
      .insert({ station_id: stationId, fuel, mode })
      .select("id")
      .single();
    return error ? null : data.id;
  } catch {
    return null;
  }
}

/** Marks a trip as arrived or cancelled. Best effort, never throws. */
export async function endTrip(id: string, status: Exclude<TripStatus, "started">): Promise<void> {
  try {
    // The end time is set by the database (trigger trips_set_ended_at).
    await supabase.from("trips").update({ status }).eq("id", id);
  } catch {
    // history only: nothing to do
  }
}

export interface TripRecord {
  id: string;
  fuel: FuelType;
  mode: TripMode;
  status: TripStatus;
  priceAtStart: number | null;
  startedAt: string;
  station: { brand: string | null; name: string | null; address: string } | null;
}

/** The signed-in user's latest trips, newest first (RLS: only theirs). */
export async function fetchMyTrips(limit = 20): Promise<TripRecord[]> {
  const { data, error } = await supabase
    .from("trips")
    // stations(...): PostgREST follows the foreign key and embeds the station.
    .select("id, fuel, mode, status, price_at_start, started_at, stations(brand, name, address)")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    fuel: row.fuel as FuelType,
    mode: row.mode as TripMode,
    status: row.status as TripStatus,
    priceAtStart: row.price_at_start,
    startedAt: row.started_at,
    station: row.stations,
  }));
}

/** Right to erasure: deletes all of the user's trips. */
export async function clearMyTrips(): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return;
  const { error } = await supabase.from("trips").delete().eq("user_id", userId);
  if (error) throw error;
}
