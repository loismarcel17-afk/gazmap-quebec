import type { FuelType, Station } from "@/features/stations/types";
import { supabase } from "./supabase";

export type FillUpAnswer = { filled: true; fuel: FuelType; pricePaid: number } | { filled: false };

/** Records the after-fill-up answer for a trip (once). Rejects on failure. */
export async function submitFillUp(tripId: string, answer: FillUpAnswer): Promise<void> {
  const { error } = await supabase
    .from("fill_ups")
    .insert(
      answer.filled
        ? { trip_id: tripId, filled: true, fuel: answer.fuel, price_paid: answer.pricePaid }
        : { trip_id: tripId, filled: false },
    );
  if (error) throw error;
}

export interface PendingTrip {
  tripId: string;
  stationId: string;
  fuel: FuelType;
  label: string | null;
}

/** The latest trip of the last 12 h still waiting for an answer, if any. */
export async function fetchPendingTrip(): Promise<PendingTrip | null> {
  const { data, error } = await supabase.rpc("pending_fill_up_trip");
  if (error) throw error;
  const row = data[0];
  return row
    ? { tripId: row.trip_id, stationId: row.station_id, fuel: row.fuel as FuelType, label: row.brand ?? row.name }
    : null;
}

/** Station name and current prices, for the feedback card. */
export async function fetchStationPrices(
  stationId: string,
): Promise<Pick<Station, "brand" | "name" | "prices"> | null> {
  const { data, error } = await supabase
    .from("stations")
    .select("brand, name, price_regular, price_premium, price_diesel")
    .eq("id", stationId)
    .maybeSingle();
  if (error) throw error;
  return (
    data && {
      brand: data.brand,
      name: data.name,
      prices: { regular: data.price_regular, premium: data.price_premium, diesel: data.price_diesel },
    }
  );
}
