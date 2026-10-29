import type { ChosenModel } from "@/features/vehicle/profile";
import { supabase } from "./supabase";

/** Model years available, newest first. */
export async function fetchModelYears(): Promise<number[]> {
  const { data, error } = await supabase.rpc("vehicle_model_years");
  if (error) throw error;
  return data;
}

/** Makes sold in a model year, alphabetical. */
export async function fetchMakes(year: number): Promise<string[]> {
  const { data, error } = await supabase.rpc("vehicle_makes", { p_year: year });
  if (error) throw error;
  return data;
}

/**
 * Every variant of a make for a year (at most a few hundred rows): the model
 * list and each model's variants are derived from it in the browser.
 */
export async function fetchVariants(year: number, make: string): Promise<ChosenModel[]> {
  const { data, error } = await supabase
    .from("vehicle_models")
    .select("id, model_year, make, model, engine_l, transmission, fuel_type, combined_l_per_100km")
    .eq("model_year", year)
    .eq("make", make)
    .order("model")
    .order("engine_l")
    .order("transmission");
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    modelYear: row.model_year,
    make: row.make,
    model: row.model,
    engineL: row.engine_l,
    transmission: row.transmission,
    // Guaranteed by the table's check constraint.
    fuelType: row.fuel_type as ChosenModel["fuelType"],
    combinedLPer100Km: row.combined_l_per_100km,
  }));
}
