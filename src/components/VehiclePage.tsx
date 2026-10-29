"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useVehicleHydrated } from "@/lib/vehicle-store";
import { VehicleForm } from "./VehicleForm";

const LICENCE_URL = "https://ouvert.canada.ca/fr/licence-du-gouvernement-ouvert-canada";

export function VehiclePage() {
  // The form starts from the saved profile: wait until it's been read.
  const hydrated = useVehicleHydrated();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 p-4 pb-10">
      <Link
        href="/"
        className="flex min-h-11 items-center gap-1 self-start rounded-full pr-3 font-medium text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t.vehicle.backToMap}
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-zinc-950">{t.vehicle.title}</h1>
        <p className="mt-1 text-zinc-700">{t.vehicle.intro}</p>
      </header>

      {hydrated ? <VehicleForm /> : <p className="text-zinc-700">{t.vehicle.loading}</p>}

      <footer className="mt-auto border-t border-zinc-200 pt-4 text-xs text-zinc-600">
        {t.vehicle.attribution}{" "}
        <a href={LICENCE_URL} className="underline hover:text-zinc-900" target="_blank" rel="noopener noreferrer">
          {t.vehicle.licence}
        </a>
      </footer>
    </main>
  );
}
