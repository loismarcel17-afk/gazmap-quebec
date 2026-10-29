import type { SupabaseClient } from "@supabase/supabase-js";
import { STATION_COLUMNS, type StationSelectRow } from "@/features/stations/rows";
import type { Database } from "./database.types";

/** Supabase's API returns at most 1 000 rows per request (max_rows in config.toml). */
const PAGE_SIZE = 1000;

/**
 * All stations, read page by page: the first request also returns the total
 * count, then the remaining pages are fetched in parallel.
 */
export async function fetchAllStationRows(client: SupabaseClient<Database>): Promise<StationSelectRow[]> {
  // Order by id so pages don't overlap or skip rows.
  const page = (from: number) =>
    client
      .from("stations")
      .select(STATION_COLUMNS, { count: from === 0 ? "exact" : undefined })
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

  const first = await page(0);
  if (first.error) throw first.error;

  const total = first.count ?? first.data.length;
  const offsets: number[] = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from);
  const others = await Promise.all(offsets.map(page));

  const rows: StationSelectRow[] = [...first.data];
  for (const result of others) {
    if (result.error) throw result.error;
    rows.push(...result.data);
  }
  return rows;
}
