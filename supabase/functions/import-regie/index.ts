// Edge Function (Deno): fetch the Régie feed and store a snapshot.
// Triggered every 15 minutes by pg_cron (see the schedule_regie_import migration).
// Local test: npm run db:import
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseRegieGeoJson, type RegieStation } from "./adapter.ts";

const FEED_URL = Deno.env.get("REGIE_FEED_URL") ?? "https://regieessencequebec.ca/stations.geojson.gz";

Deno.serve(async (request) => {
  // verify_jwt only checks that the token is a valid Supabase key, and the public
  // anon key is one. Require the service_role key so visitors can't trigger imports.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey || request.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return json({ error: "forbidden" }, 403);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, {
    auth: { persistSession: false },
  });
  const log = async (run: Record<string, unknown>) => {
    const { error } = await db.from("import_runs").insert(run);
    if (error) console.error("import_runs insert failed:", error.message);
  };

  try {
    // ETag of the last feed we processed: lets the Régie answer "304 Not Modified"
    // instead of sending the whole file again.
    const { data: lastRun } = await db
      .from("import_runs")
      .select("source_etag")
      .neq("status", "failed")
      .not("source_etag", "is", null)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastEtag: string | null = lastRun?.source_etag ?? null;

    const response = await fetch(FEED_URL, {
      headers: lastEtag ? { "If-None-Match": lastEtag } : {},
      signal: AbortSignal.timeout(20_000),
    });

    if (response.status === 304) {
      await log({ status: "not_modified", source_etag: lastEtag });
      return json({ status: "not_modified" });
    }
    if (!response.ok) throw new Error(`Feed answered HTTP ${response.status}`);

    // The server sends Content-Encoding: gzip, so fetch has already decompressed it.
    const feed = parseRegieGeoJson(await response.json());
    if (feed.stations.length === 0) throw new Error("Feed contains no usable station");

    const { data, error } = await db.rpc("import_regie_stations", {
      p_published_at: feed.publishedAt,
      p_stations: feed.stations.map(toRow),
    });
    if (error) throw new Error(`import_regie_stations: ${error.message}`);

    const result = (data as { station_count: number; price_change_count: number }[])[0];
    // 0 stations stored for a non-empty feed = older than what we have (see the SQL function).
    const status = result.station_count === 0 ? "skipped_stale" : "imported";
    const summary = {
      status,
      source_etag: response.headers.get("ETag"),
      published_at: feed.publishedAt,
      station_count: result.station_count,
      price_change_count: result.price_change_count,
      issue_count: feed.issues.length,
    };
    await log(summary);
    return json({ ...summary, issues: feed.issues.slice(0, 20) });
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    await log({ status: "failed", error: message });
    console.error("Régie import failed:", message);
    return json({ status: "failed", error: message }, 500);
  }
});

/** Adapter output → the flat, snake_case shape of public.regie_station_input */
function toRow(station: RegieStation) {
  return {
    id: station.id,
    name: station.name,
    brand: station.brand,
    address: station.address,
    region: station.region,
    postal_code: station.postalCode,
    lat: station.lat,
    lng: station.lng,
    status: station.status,
    price_regular: station.prices.regular,
    price_premium: station.prices.premium,
    price_diesel: station.prices.diesel,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
