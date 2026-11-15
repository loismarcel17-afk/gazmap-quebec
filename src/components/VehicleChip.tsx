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

/** Signed out: the vehicle is only used to calculate the fill-up, which needs an account. */
export function CalculateChip() {
  return (
    <Link
      href="/compte"
      className="flex min-h-11 items-center gap-2 self-start rounded-full bg-blue-800 px-4 text-sm font-medium text-white shadow-md hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
    >
      {/* Fuel pump icon */}
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M3 20h12M6 8h6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t.vehicle.chipSignedOut}
    </Link>
  );
}

/** "Planifier un trajet": A → B, best stations on the way or at the destination (accounts; the page explains). */
export function PlanTripChip() {
  return (
    <Link
      href="/planifier"
      className="flex min-h-11 items-center gap-2 self-start rounded-full bg-white px-4 text-sm font-medium text-zinc-900 shadow-md hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
    >
      {/* Route icon: two points joined by a path */}
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-blue-700" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" strokeLinecap="round" />
      </svg>
      {t.planner.chip}
    </Link>
  );
}
