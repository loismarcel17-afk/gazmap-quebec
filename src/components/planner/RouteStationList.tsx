import Link from "next/link";
import type { RankedStation } from "@/features/recommendation/rank";
import { formatDistance, formatInteger, formatMoney, formatPrice } from "@/lib/format";
import { interpolate, plural, t } from "@/lib/i18n";
import type { FillUpAssumptions } from "../NearbyList";

const MAX_ITEMS = 50;
/** Under 300 m extra, the station is "on the way": an exit and back on. */
const ON_THE_WAY_METERS = 300;
const decimal = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 });

interface RouteStationListProps {
  title: string;
  results: RankedStation[];
  assumptions: FillUpAssumptions;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Stations along a planned trip, by total fill-up cost (detour = extra road vs the direct route). */
export function RouteStationList({ title, results, assumptions, selectedId, onSelect }: RouteStationListProps) {
  const best = results[0];
  const allByRoad = results.slice(0, 23).every((entry) => entry.detourSource === "road");

  return (
    <section
      aria-labelledby="route-list-title"
      className="flex max-h-[50dvh] min-h-0 flex-col rounded-2xl bg-white shadow-md sm:max-h-none sm:flex-1"
    >
      <header className="border-b border-zinc-200 p-3">
        <h2 id="route-list-title" className="truncate font-semibold text-zinc-950">
          {title}
        </h2>
        <p className="text-xs text-zinc-600">
          {plural(t.planner.onTheWaySummary, results.length, { count: formatInteger(results.length) })}
        </p>
      </header>

      {!best ? (
        <p className="p-4 text-sm text-zinc-800">{t.planner.onTheWayEmpty}</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="m-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-950">
            <p className="text-xs font-semibold tracking-wide text-blue-800 uppercase">{t.nearby.best}</p>
            <p className="flex items-baseline justify-between gap-2">
              <span className="truncate text-base font-semibold">{best.station.brand ?? t.station.independent}</span>
              <span className="shrink-0 text-xl font-bold tabular-nums">{formatMoney(best.cost.total)}</span>
            </p>
            <p className="mt-0.5">
              {interpolate(t.planner.breakdown, {
                litres: decimal.format(assumptions.litres),
                price: formatPrice(best.price),
                detour: formatMoney(best.cost.detourCost),
                distance: formatDistance(best.cost.detourMeters),
              })}
            </p>
          </div>

          <ol className="p-1">
            {results.slice(0, MAX_ITEMS).map((entry, index) => (
              <li key={entry.station.id} data-station-id={entry.station.id}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.station.id)}
                  aria-current={entry.station.id === selectedId ? "true" : undefined}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-700 aria-[current=true]:bg-zinc-100 aria-[current=true]:ring-2 aria-[current=true]:ring-zinc-900"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate font-medium text-zinc-950">
                        {entry.station.brand ?? t.station.independent}
                      </span>
                      {index === 0 && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {t.nearby.best}
                        </span>
                      )}
                      {entry.station.sponsored && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">
                          {t.nearby.sponsored}
                        </span>
                      )}
                    </span>
                    <span className="flex gap-1 text-xs text-zinc-600">
                      <span className="truncate">{entry.station.address}</span>
                      <span className="shrink-0">
                        ·{" "}
                        {entry.cost.detourMeters < ON_THE_WAY_METERS
                          ? t.planner.noDetour
                          : interpolate(t.planner.detour, { distance: formatDistance(entry.cost.detourMeters) })}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold text-zinc-950 tabular-nums">{formatMoney(entry.cost.total)}</span>
                    <span className="block text-xs text-zinc-600 tabular-nums">{formatPrice(entry.price)}</span>
                  </span>
                </button>
              </li>
            ))}
            {results.length > MAX_ITEMS && (
              <li className="px-3 py-2 text-xs text-zinc-600">{interpolate(t.nearby.truncated, { count: MAX_ITEMS })}</li>
            )}
          </ol>

          <p className="px-3 pt-1 pb-3 text-xs text-zinc-600">
            {allByRoad ? t.planner.detourRoad : t.planner.detourEstimated}{" "}
            {assumptions.hasVehicle
              ? interpolate(t.nearby.assumptions, {
                  litres: decimal.format(assumptions.litres),
                  consumption: decimal.format(assumptions.consumptionLPer100Km),
                })
              : t.nearby.assumptionsDefault}{" "}
            {!assumptions.hasVehicle && (
              <Link href="/vehicule" className="font-medium text-blue-800 underline">
                {t.nearby.addVehicle}
              </Link>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
