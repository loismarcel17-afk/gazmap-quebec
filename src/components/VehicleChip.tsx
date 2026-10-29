"use client";

import Link from "next/link";
import { interpolate, t } from "@/lib/i18n";
import { useVehicleHydrated, useVehicleStore } from "@/lib/vehicle-store";

const decimal = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 });

/** Link to /vehicule showing the saved vehicle, or an invitation to add one. */
export function VehicleChip() {
  const hydrated = useVehicleHydrated();
  const model = useVehicleStore((state) => state.model);
  // Before the profile is read, render nothing rather than a wrong "add your vehicle".
  if (!hydrated) return null;

  return (
    <Link
      href="/vehicule"
      className="flex min-h-11 items-center gap-2 self-start rounded-full bg-white px-4 text-sm font-medium text-zinc-800 shadow-md hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-blue-700"
    >
      {/* Car icon */}
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 16h14M6 16l1.5-5h9L18 16M5 16v3M19 16v3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="14" r="0.5" fill="currentColor" />
        <circle cx="16" cy="14" r="0.5" fill="currentColor" />
      </svg>
      <span className="truncate">
        {model
          ? interpolate(t.vehicle.chip, {
              make: model.make,
              model: model.model,
              year: model.modelYear,
              consumption: decimal.format(model.combinedLPer100Km),
            })
          : t.vehicle.chipEmpty}
      </span>
    </Link>
  );
}
