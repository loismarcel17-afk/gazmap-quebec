import type { LatLng } from "@/features/geo/geo";
import { supabase } from "./supabase";

/** Station position and display name by id, or null if it doesn't exist. */
export async function fetchStationLocation(
  id: string,
): Promise<(LatLng & { name: string | null; brand: string | null }) | null> {
  const { data, error } = await supabase
    .from("stations")
    .select("lat, lng, name, brand")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
