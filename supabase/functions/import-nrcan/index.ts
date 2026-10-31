// Edge Function (Deno): import NRCan fuel consumption ratings into vehicle_models.
// NRCan updates these a few times a year: run it by hand with npm run db:import-vehicles.
// Source: Natural Resources Canada, Open Government Licence – Canada.
import { createClient } from "npm:@supabase/supabase-js@2";
import { serviceRoleToken } from "../_shared/service-auth.ts";
import { decodeNrcanCsv, parseNrcanCsv, selectRatingFiles, type VehicleModel } from "./adapter.ts";

const CATALOG_URL =
  "https://open.canada.ca/data/api/action/package_show?id=98f1a129-f628-4ce4-b24d-6f16bf24dd64";
/** Rows per database call: keeps each request well under the API's size limit. */
const BATCH_SIZE = 2000;

Deno.serve(async (request) => {
  // Only the server (service_role key) may import: see _shared/service-auth.ts.
  const serviceKey = serviceRoleToken(request.headers.get("Authorization"));
  if (!serviceKey) return json({ error: "forbidden" }, 403);
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const catalog = await fetchOk(CATALOG_URL).then((response) => response.json());
    const urls = selectRatingFiles(catalog.result);
    if (urls.length === 0) throw new Error("No rating file found in the NRCan catalog");

    const files = [];
    let imported = 0;
    for (const url of urls) {
      const bytes = new Uint8Array(await (await fetchOk(url)).arrayBuffer());
      const { models, issues } = parseNrcanCsv(decodeNrcanCsv(bytes));
      for (let start = 0; start < models.length; start += BATCH_SIZE) {
        const { data, error } = await db.rpc("import_nrcan_models", {
          p_models: models.slice(start, start + BATCH_SIZE).map(toRow),
        });
        if (error) throw new Error(`import_nrcan_models: ${error.message}`);
        imported += data as number;
      }
      files.push({ file: url.slice(url.lastIndexOf("/") + 1), models: models.length, issues });
    }
    return json({ status: "imported", imported, files });
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    console.error("NRCan import failed:", message);
    return json({ status: "failed", error: message }, 500);
  }
});

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`);
  return response;
}

/** Adapter output → snake_case columns of public.vehicle_models */
function toRow(model: VehicleModel) {
  return {
    model_year: model.modelYear,
    make: model.make,
    model: model.model,
    vehicle_class: model.vehicleClass,
    engine_l: model.engineL,
    cylinders: model.cylinders,
    transmission: model.transmission,
    fuel_type: model.fuelType,
    city_l_per_100km: model.cityLPer100Km,
    highway_l_per_100km: model.highwayLPer100Km,
    combined_l_per_100km: model.combinedLPer100Km,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
