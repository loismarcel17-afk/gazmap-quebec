// GET /api/stations — every station with its current prices, in the compact
// format (src/features/stations/compact.ts). Public data, the same for every
// visitor: the CDN keeps it 60 s, so most visits never reach Supabase.
// Prices change at most every 15 minutes (import-regie).
import { promisify } from "node:util";
import { brotliCompress, constants, gzip as gzipCallback } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { encodeSnapshot } from "@/features/stations/compact";
import type { Database } from "@/lib/database.types";
import { fetchAllStationRows } from "@/lib/station-rows";

const brotli = promisify(brotliCompress);
const gzip = promisify(gzipCallback);
const MAX_AGE_S = 60;
const CACHE_CONTROL = `public, max-age=0, s-maxage=${MAX_AGE_S}, stale-while-revalidate=600`;

interface Encoded {
  at: number;
  json: string;
  br: Uint8Array<ArrayBuffer>;
  gzip: Uint8Array<ArrayBuffer>;
}

// The last list built by this server, reused for MAX_AGE_S like the CDN does:
// read from Supabase and compressed once a minute at most, not per visit. The
// promise is shared, so simultaneous first visits trigger a single build.
let latest: Promise<Encoded> | null = null;

async function build(url: string, key: string): Promise<Encoded> {
  // The public key, like the browser: it can only read what RLS allows (stations).
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const json = JSON.stringify(encodeSnapshot(await fetchAllStationRows(supabase)));
  // Compressed here rather than left to the host: the same on every server.
  // Brotli level 10: ~350 kB → ~85 kB in ~0.2 s (level 11: 1 % smaller but 3×
  // slower; level 9: 17 % bigger). gzip for the rare browser without brotli.
  const [br, gz] = await Promise.all([
    brotli(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 10 } }),
    gzip(json, { level: 9 }),
  ]);
  return { at: Date.now(), json, br: new Uint8Array(br), gzip: new Uint8Array(gz) };
}

export async function GET(request: Request): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ error: "not_configured" }, { status: 503 });

  const current = latest;
  if (!current || Date.now() - (await current.catch(() => ({ at: 0 }))).at > MAX_AGE_S * 1000) {
    latest = build(url, key);
  }
  try {
    const encoded = await latest!;
    const headers = { "Content-Type": "application/json", "Cache-Control": CACHE_CONTROL, Vary: "Accept-Encoding" };
    const accepted = request.headers.get("accept-encoding") ?? "";
    if (/\bbr\b/.test(accepted)) return new Response(encoded.br, { headers: { ...headers, "Content-Encoding": "br" } });
    if (/\bgzip\b/.test(accepted)) return new Response(encoded.gzip, { headers: { ...headers, "Content-Encoding": "gzip" } });
    return new Response(encoded.json, { headers });
  } catch {
    latest = null; // try again on the next request
    console.error("Station list unavailable from Supabase");
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
