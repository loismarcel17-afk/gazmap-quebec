"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { buildPlaceIndex } from "@/features/places/places";
import { findNearbyStations } from "@/features/stations/nearby";
import { computePriceScale } from "@/features/stations/price-scale";
import type { FuelType } from "@/features/stations/types";
import { fuelForModel } from "@/features/vehicle/profile";
import { interpolate, t } from "@/lib/i18n";
import { fetchStationsSnapshot } from "@/lib/stations-api";
import { useVehicleStore } from "@/lib/vehicle-store";
import { FuelSelector } from "./FuelSelector";
import { LocationSearch, type Origin } from "./LocationSearch";
import { NearbyList, type RadiusKm } from "./NearbyList";
import { OfflineBanner } from "./OfflineBanner";
import { PendingFillUpBanner } from "./PendingFillUpBanner";
import { StorageNotice } from "./StorageNotice";
import { PriceLegend } from "./PriceLegend";
import { StationSheet } from "./StationSheet";
import { AccountChip } from "./AccountChip";
import { VehicleChip } from "./VehicleChip";
import type { Selection } from "./station-map/StationMap";
import { useRankedStations } from "./useRankedStations";

// MapLibre needs the browser (window, WebGL): skip server rendering, and load
// its ~1 MB of JavaScript in a separate chunk so the page shell appears first.
const StationMap = dynamic(() => import("./station-map/StationMap"), { ssr: false });

/** Prices change through the day: refresh while the page is open (paused in background tabs). */
const REFRESH_MS = 5 * 60 * 1000;

export function HomeView() {
  // TanStack Query handles loading / error / retry / caching / periodic refresh.
  const query = useQuery({
    queryKey: ["stations"],
    queryFn: fetchStationsSnapshot,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
  });
  // Fuel shown: the user's choice, else their vehicle's fuel, else regular.
  const [chosenFuel, setChosenFuel] = useState<FuelType | null>(null);
  const vehicleFuel = useVehicleStore((state) => fuelForModel(state.model));
  const fuel = chosenFuel ?? vehicleFuel ?? "regular";
  const [selection, setSelection] = useState<Selection | null>(null);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(10);

  const snapshot = query.data;
  const stations = useMemo(() => snapshot?.stations ?? [], [snapshot]);
  const scale = useMemo(() => computePriceScale(stations, fuel), [stations, fuel]);
  const places = useMemo(() => buildPlaceIndex(stations), [stations]);
  const nearby = useMemo(
    () => (origin ? findNearbyStations(stations, origin, radiusKm * 1000, fuel) : []),
    [stations, origin, radiusKm, fuel],
  );
  const { ranked, assumptions } = useRankedStations(nearby, origin);
  const visibleCount = useMemo(
    () => stations.filter((station) => station.prices[fuel] !== null).length,
    [stations, fuel],
  );
  const selected = selection ? stations.find((station) => station.id === selection.id) : undefined;

  // Stable identities (useCallback) so children's effects don't re-run on every render.
  const closeSheet = useCallback(() => {
    // Opened from the list: give keyboard / screen-reader focus back to that
    // station, instead of losing it at the top of the page (WCAG 2.4.3).
    if (selection?.from === "list") {
      const id = selection.id;
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-station-id="${CSS.escape(id)}"] button`)?.focus(),
      );
    }
    setSelection(null);
  }, [selection]);
  const selectFromMap = useCallback((id: string | null) => setSelection(id ? { id, from: "map" } : null), []);
  const selectFromList = useCallback((id: string) => setSelection({ id, from: "list" }), []);
  const changeOrigin = useCallback((next: Origin | null) => {
    setOrigin(next);
    setSelection(null);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-zinc-200">
      <h1 className="sr-only">{t.app.name}</h1>

      <div role="region" aria-label={t.map.label} className="absolute inset-0">
        {scale && (
          <StationMap
            stations={stations}
            fuel={fuel}
            scale={scale}
            selection={selection}
            onSelect={selectFromMap}
            origin={origin}
            radiusMeters={radiusKm * 1000}
          />
        )}
      </div>

      {query.isPending && (
        <p role="status" className="absolute inset-0 flex items-center justify-center text-zinc-700">
          {t.map.loading}
        </p>
      )}

      {/* Loaded but empty: the importer hasn't run yet (local database). */}
      {query.isSuccess && stations.length === 0 && (
        <p role="status" className="absolute inset-0 flex items-center justify-center p-6 text-center text-zinc-700">
          {t.map.empty}
        </p>
      )}

      {/* Only when nothing is shown: a failed background refresh keeps the last prices on screen. */}
      {query.isError && !snapshot && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-zinc-800">{t.map.error}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="min-h-11 rounded-full bg-zinc-900 px-5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {t.map.retry}
          </button>
        </div>
      )}

      {/*
        Controls overlay. Phones: search on top, list/legend pushed to the bottom
        (mt-auto). Wider screens: the same elements form a left sidebar.
        pointer-events-none on the frame lets the map receive drags in the empty
        middle; each panel opts back in with pointer-events-auto.
      */}
      <div className="pointer-events-none absolute inset-x-3 top-3 bottom-10 z-10 flex flex-col gap-2 sm:right-auto sm:bottom-3 sm:w-96">
        <div className="pointer-events-auto rounded-full bg-white shadow-md">
          <FuelSelector value={fuel} onChange={setChosenFuel} />
        </div>

        {snapshot && (
          <div className="pointer-events-auto">
            <LocationSearch places={places} onOriginChange={changeOrigin} />
          </div>
        )}

        <div className="pointer-events-auto flex flex-wrap gap-2 self-start">
          <VehicleChip />
          <AccountChip />
        </div>

        <div className="pointer-events-auto flex flex-col gap-2">
          <OfflineBanner />
          <PendingFillUpBanner />
        </div>

        <div className="mt-auto flex min-h-0 flex-col gap-2 sm:flex-1">
          <div className="pointer-events-auto">
            <StorageNotice />
          </div>
          {origin && (
            <div className="pointer-events-auto flex min-h-0 flex-col sm:flex-1 sm:justify-end">
              <NearbyList
                title={origin.fromDevice ? t.nearby.titleNearYou : interpolate(t.nearby.title, { place: origin.label })}
                results={ranked}
                assumptions={assumptions}
                radiusKm={radiusKm}
                onRadiusChange={setRadiusKm}
                selectedId={selection?.id ?? null}
                onSelect={selectFromList}
              />
            </div>
          )}

          {snapshot && scale && (
            // With a list open, phones hide the legend: no room, and the list shows prices.
            <div className={`pointer-events-auto ${origin ? "hidden sm:block" : ""}`}>
              <PriceLegend scale={scale} stationCount={visibleCount} updatedAt={snapshot.updatedAt} />
            </div>
          )}
        </div>
      </div>

      {selected && <StationSheet station={selected} fuel={fuel} onClose={closeSheet} />}
    </main>
  );
}
