// GET /api/sante — 200 when prices are being imported, 503 otherwise.
// For an uptime monitor (docs/DEPLOIEMENT.md) that e-mails the team on a 503,
// so stale prices never go unnoticed. Times and status only: nothing personal.
import { createClient } from "@supabase/supabase-js";
import { importHealth } from "@/features/stations/import-health";
import type { Database } from "@/lib/database.types";

export async function GET(): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return answer(503, { status: "down", reason: "not_configured" });

  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("import_health");
  // Supabase itself unreachable: that's down too.
  if (error || !data[0]) return answer(503, { status: "down", reason: "database_unreachable" });

  const row = data[0];
  const health = importHealth({ lastOkAt: row.last_ok_at, pricesPublishedAt: row.prices_published_at });
  const details = {
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastOkAt: row.last_ok_at,
    pricesPublishedAt: row.prices_published_at,
  };
  return health.healthy
    ? answer(200, { status: "ok", ...details })
    : answer(503, { status: "down", reason: health.reason, ...details });
}

function answer(status: number, body: Record<string, unknown>): Response {
  // Always the live state: never cached by the CDN or the browser.
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
