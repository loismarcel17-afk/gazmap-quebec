import Link from "next/link";
import { useEffect, useRef } from "react";
import type { RankedStation } from "@/features/recommendation/rank";
import { formatDistance, formatInteger, formatMoney, formatPrice } from "@/lib/format";
import { interpolate, plural, t } from "@/lib/i18n";

export const RADIUS_OPTIONS_KM = [5, 10, 25, 50] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS_KM)[number];

/** Long lists cost render time on phones and nobody scrolls past the 50 best. */
const MAX_ITEMS = 50;
/** Savings under 1 ¢ (10 tenths of a cent) aren't worth mentioning. */
const MIN_SAVINGS = 10;

const decimal = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 });

export interface FillUpAssumptions {
  litres: number;
  consumptionLPer100Km: number;
  /** false: defaults (40 L, 9.5 L/100 km) were used */
  hasVehicle: boolean;
}

interface NearbyListProps {
  /** "Près de Rimouski" or "Près de vous" */
  title: string;
  /** Ranked by total fill-up cost, best first */
  results: RankedStation[];
  assumptions: FillUpAssumptions;
  radiusKm: RadiusKm;
  onRadiusChange: (radius: RadiusKm) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** One-way distance used for the detour (road, estimated or straight line). */
const oneWay = (entry: RankedStation) => entry.cost.detourMeters / 2;

export function NearbyList({
  title,
  results,
  assumptions,
  radiusKm,
  onRadiusChange,
  selectedId,
  onSelect,
}: NearbyListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const shown = results.slice(0, MAX_ITEMS);
  const widerRadius = RADIUS_OPTIONS_KM.find((radius) => radius > radiusKm);

  // When a station is picked on the map, scroll the list to it.
  useEffect(() => {
    if (!selectedId) return;
    const item = listRef.current?.querySelector(`[data-station-id="${selectedId}"]`);
    item?.scrollIntoView?.({ block: "nearest" }); // `?.()`: not implemented in jsdom
  }, [selectedId]);

  return (
    <section
      aria-labelledby="nearby-title"
      className="flex max-h-[50dvh] min-h-0 flex-col rounded-2xl bg-white shadow-md sm:max-h-none sm:flex-1"
    >
      <header className="border-b border-zinc-200 p-3">
        <h2 id="nearby-title" className="truncate font-semibold text-zinc-950">
          {title}
        </h2>
        <p className="text-xs text-zinc-600">
          {plural(t.nearby.summary, results.length, { count: formatInteger(results.length), radius: radiusKm })}
        </p>
        <div role="group" aria-label={t.nearby.radius} className="mt-2 flex gap-1">
          {RADIUS_OPTIONS_KM.map((radius) => (
            <button
              key={radius}
              type="button"
              aria-pressed={radius === radiusKm}
              onClick={() => onRadiusChange(radius)}
              className="min-h-11 flex-1 rounded-full bg-zinc-100 text-sm font-medium text-zinc-700 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 aria-pressed:bg-zinc-900 aria-pressed:text-white"
            >
              {interpolate(t.nearby.radiusOption, { radius })}
            </button>
          ))}
        </div>
      </header>

      {results.length === 0 ? (
        <div className="p-4 text-sm text-zinc-800">
          <p>{interpolate(t.nearby.empty, { radius: radiusKm })}</p>
          {widerRadius && (
            <button
              type="button"
              onClick={() => onRadiusChange(widerRadius)}
              className="mt-3 min-h-11 rounded-full bg-zinc-900 px-5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {interpolate(t.nearby.widen, { radius: widerRadius })}
            </button>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <BestChoice results={results} assumptions={assumptions} />
          <ol ref={listRef} className="p-1">
            {shown.map((entry, index) => (
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
                      {index === 0 && <Tag tone="best">{t.nearby.best}</Tag>}
                      {entry.station.sponsored && <Tag tone="sponsored">{t.nearby.sponsored}</Tag>}
                    </span>
                    {/* Only the address is cut when space runs out, never the distance. */}
                    <span className="flex gap-1 text-xs text-zinc-600">
                      <span className="truncate">{entry.station.address}</span>
                      <span className="shrink-0">
                        · {interpolate(t.nearby.distance, { distance: formatDistance(oneWay(entry)) })}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold text-zinc-950 tabular-nums">
                      {formatMoney(entry.cost.total)}
                    </span>
                    <span className="block text-xs text-zinc-600 tabular-nums">{formatPrice(entry.price)}</span>
                  </span>
                </button>
              </li>
            ))}
            {results.length > MAX_ITEMS && (
              <li className="px-3 py-2 text-xs text-zinc-600">
                {interpolate(t.nearby.truncated, { count: MAX_ITEMS })}
              </li>
            )}
          </ol>
          <Assumptions results={results} assumptions={assumptions} />
        </div>
      )}
    </section>
  );
}

/** The recommended station, with the arithmetic behind it. */
function BestChoice({ results, assumptions }: { results: RankedStation[]; assumptions: FillUpAssumptions }) {
  const best = results[0];
  // Cheapest per litre (closest on ties): what a "lowest price" app would have suggested.
  const cheapestPerLitre = results.reduce((a, b) =>
    b.price < a.price || (b.price === a.price && b.distanceMeters < a.distanceMeters) ? b : a,
  );
  const savings = cheapestPerLitre.cost.total - best.cost.total;

  return (
    <div className="m-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-950">
      <p className="text-xs font-semibold tracking-wide text-blue-800 uppercase">{t.nearby.best}</p>
      <p className="flex items-baseline justify-between gap-2">
        <span className="truncate text-base font-semibold">{best.station.brand ?? t.station.independent}</span>
        <span className="shrink-0 text-xl font-bold tabular-nums">{formatMoney(best.cost.total)}</span>
      </p>
      <p className="mt-0.5">
        {interpolate(t.nearby.breakdown, {
          litres: decimal.format(assumptions.litres),
          price: formatPrice(best.price),
          detour: formatMoney(best.cost.detourCost),
          distance: formatDistance(best.cost.detourMeters),
        })}
      </p>
      {cheapestPerLitre.station.id !== best.station.id && savings >= MIN_SAVINGS && (
        <p className="mt-1 font-medium">
          {interpolate(t.nearby.savings, {
            amount: formatMoney(savings),
            price: formatPrice(cheapestPerLitre.price),
            distance: formatDistance(oneWay(cheapestPerLitre)),
          })}
        </p>
      )}
    </div>
  );
}

/** How the costs were computed: honesty about estimates and defaults. */
function Assumptions({ results, assumptions }: { results: RankedStation[]; assumptions: FillUpAssumptions }) {
  const sources = new Set(results.map((entry) => entry.detourSource));
  const detour = sources.has("straightLine")
    ? t.nearby.detour.straightLine
    : sources.has("estimated")
      ? t.nearby.detour.estimated
      : t.nearby.detour.road;

  return (
    <p className="px-3 pt-1 pb-3 text-xs text-zinc-600">
      {detour}{" "}
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
  );
}

function Tag({ tone, children }: { tone: "best" | "sponsored"; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        tone === "best" ? "bg-blue-50 text-blue-800" : "bg-amber-100 text-amber-950"
      }`}
    >
      {children}
    </span>
  );
}
