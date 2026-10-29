import Link from "next/link";
import { useEffect, useRef } from "react";
import { fuelToParam } from "@/features/stations/fuel-param";
import { FUEL_TYPES, type FuelType, type Station } from "@/features/stations/types";
import { formatPrice } from "@/lib/format";
import { t } from "@/lib/i18n";

interface StationSheetProps {
  station: Station;
  fuel: FuelType;
  onClose: () => void;
}

/** Station details: bottom sheet on phones, card at the top right (beside the zoom buttons) on wider screens. */
export function StationSheet({ station, fuel, onClose }: StationSheetProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move keyboard / screen-reader focus to the newly opened station.
  useEffect(() => {
    headingRef.current?.focus();
  }, [station.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <section
      aria-labelledby="station-sheet-title"
      className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-white p-4 pb-6 shadow-2xl sm:inset-x-auto sm:top-3 sm:right-14 sm:bottom-auto sm:w-96 sm:rounded-2xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-600">{station.brand ?? t.station.independent}</p>
          <h2
            id="station-sheet-title"
            ref={headingRef}
            tabIndex={-1}
            className="truncate text-lg font-semibold text-zinc-950 outline-none"
          >
            {station.name ?? t.station.unnamed}
          </h2>
          <p className="text-sm text-zinc-700">{station.address}</p>
          <p className="text-sm text-zinc-600">
            {station.region} · {station.postalCode}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.station.close}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <h3 className="mt-4 text-xs font-medium tracking-wide text-zinc-600 uppercase">{t.station.prices}</h3>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {FUEL_TYPES.map((type) => {
          const price = station.prices[type];
          const isSelected = type === fuel;
          return (
            <div
              key={type}
              className={`rounded-xl p-2 ${isSelected ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"}`}
            >
              <dt className={`text-xs ${isSelected ? "text-zinc-300" : "text-zinc-600"}`}>{t.fuel[type]}</dt>
              <dd className={price === null ? "text-sm" : "text-base font-semibold tabular-nums"}>
                {price === null ? t.station.notAvailable : formatPrice(price)}
              </dd>
            </div>
          );
        })}
      </dl>

      <Link
        href={`/trajet/${station.id}?carburant=${fuelToParam(fuel)}`}
        className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-blue-700 text-lg font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        {t.station.go}
      </Link>
    </section>
  );
}
