"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { findNearbyStations } from "@/features/stations/nearby";
import { computePriceScale } from "@/features/stations/price-scale";
import type { FuelType } from "@/features/stations/types";
import { fuelForModel } from "@/features/vehicle/profile";
import { formatDistance, formatDuration } from "@/lib/format";
import { GeolocationFailure, getCurrentPosition, type GeolocationFailureReason } from "@/lib/geolocation";
import { interpolate, t } from "@/lib/i18n";
import { savePlannedDestination } from "@/lib/planned-trip";
import { useSession } from "@/lib/session";
import { fetchStationsSnapshot } from "@/lib/stations-api";
import { useVehicleStore } from "@/lib/vehicle-store";
import { FuelSelector } from "../FuelSelector";
import { NearbyList, type RadiusKm } from "../NearbyList";
import { StationSheet } from "../StationSheet";
import type { Selection } from "../station-map/StationMap";
import { useRankedStations } from "../useRankedStations";
import { AddressField, type Place } from "./AddressField";
import { RouteStationList } from "./RouteStationList";
import { usePlannedStations } from "./usePlannedStations";

const StationMap = dynamic(() => import("../station-map/StationMap"), { ssr: false });

type FillUpWhere = "onTheWay" | "atDestination";

const PANEL = "pointer-events-auto rounded-2xl bg-white p-3 shadow-md";
const LINK =
  "flex min-h-11 items-center gap-1 self-start rounded-full pr-3 font-medium text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700";

/** /planifier: A → B, then the best stations on the way or at the destination (PLAN.md task 18). */
export function PlannerView() {
  const session = useSession();
  if (session.status === "signedIn") return <Planner />;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 p-4 pb-10">
      <BackToMap />
      <header>
        <h1 className="text-2xl font-semibold text-zinc-950">{t.planner.title}</h1>
        <p className="mt-1 text-zinc-700">{t.planner.intro}</p>
      </header>
      {session.status === "signedOut" ? (
        <div className="rounded-2xl bg-blue-50 p-4 text-blue-950">
          <p>{t.planner.signInRequired}</p>
          <Link
            href="/compte"
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-blue-800 px-5 font-medium text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {t.planner.signInCta}
          </Link>
        </div>
      ) : (
        <p className="text-zinc-700">{t.account.loading}</p>
      )}
    </main>
  );
}

function Planner() {
  const stationsQuery = useQuery({ queryKey: ["stations"], queryFn: fetchStationsSnapshot, staleTime: 5 * 60 * 1000 });
  const stations = useMemo(() => stationsQuery.data?.stations ?? [], [stationsQuery.data]);

  const [chosenFuel, setChosenFuel] = useState<FuelType | null>(null);
  const vehicleFuel = useVehicleStore((state) => fuelForModel(state.model));
  const fuel = chosenFuel ?? vehicleFuel ?? "regular";
  const scale = useMemo(() => computePriceScale(stations, fuel), [stations, fuel]);

  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [where, setWhere] = useState<FillUpWhere | null>(null);
  const [editing, setEditing] = useState(true);
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(5);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<GeolocationFailureReason | null>(null);

  const ready = origin !== null && destination !== null;
  const showing = ready && where !== null && !editing;

  // "En chemin": only asks for the route once that's what the user chose.
  const onTheWay = usePlannedStations(
    stations,
    showing && where === "onTheWay" ? origin : null,
    showing && where === "onTheWay" ? destination : null,
    fuel,
  );
  // "À destination": the usual ranking, around B instead of around the user.
  const nearDestination = useMemo(
    () => (showing && where === "atDestination" ? findNearbyStations(stations, destination, radiusKm * 1000, fuel) : []),
    [showing, where, stations, destination, radiusKm, fuel],
  );
  const atDestination = useRankedStations(nearDestination, showing && where === "atDestination" ? destination : null);

  const mapStations = useMemo(() => {
    if (!showing) return stations;
    const shown = where === "onTheWay" ? onTheWay.ranked : atDestination.ranked;
    return shown.map((entry) => entry.station);
  }, [showing, where, stations, onTheWay.ranked, atDestination.ranked]);
  const selected = selection ? stations.find((station) => station.id === selection.id) : undefined;

  async function locate() {
    setLocating(true);
    setLocateError(null);
    try {
      const position = await getCurrentPosition();
      setOrigin({ ...position, label: t.planner.myPosition, fromDevice: true });
    } catch (failure) {
      setLocateError(failure instanceof GeolocationFailure ? failure.reason : "unavailable");
    } finally {
      setLocating(false);
    }
  }

  function choose(next: FillUpWhere) {
    setWhere(next);
    setEditing(false);
    setSelection(null);
  }

  const closeSheet = useCallback(() => setSelection(null), []);
  const selectFromMap = useCallback((id: string | null) => setSelection(id ? { id, from: "map" } : null), []);
  const selectFromList = useCallback((id: string) => setSelection({ id, from: "list" }), []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-zinc-200">
      <h1 className="sr-only">{t.planner.title}</h1>

      <div role="region" aria-label={t.map.label} className="absolute inset-0">
        {scale && (
          <StationMap
            stations={mapStations}
            fuel={fuel}
            scale={scale}
            selection={selection}
            onSelect={selectFromMap}
            origin={showing && where === "atDestination" ? destination : (origin ?? null)}
            radiusMeters={showing && where === "atDestination" ? radiusKm * 1000 : 0}
            route={
              showing && where === "onTheWay" && onTheWay.route && destination
                ? { geometry: onTheWay.route.geometry, destination }
                : null
            }
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-3 top-3 bottom-10 z-10 flex flex-col gap-2 sm:right-auto sm:bottom-3 sm:w-96">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white pl-1 shadow-md">
          <Link href="/" aria-label={t.planner.backToMap} className="flex size-11 shrink-0 items-center justify-center rounded-full text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700">
            <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="flex-1">
            <FuelSelector value={fuel} onChange={setChosenFuel} />
          </div>
        </div>

        {editing || !ready || where === null ? (
          <section aria-labelledby="planner-form-title" className={`${PANEL} flex flex-col gap-3`}>
            <h2 id="planner-form-title" className="font-semibold text-zinc-950">
              {t.planner.title}
            </h2>
            <AddressField
              label={t.planner.from}
              value={origin}
              onChange={setOrigin}
              near={null}
              onLocate={locate}
              locating={locating}
            />
            <AddressField label={t.planner.to} value={destination} onChange={setDestination} near={origin} />
            <p aria-live="polite" className="text-xs text-zinc-600">
              {locating ? t.planner.locating : locateError ? t.search.errors[locateError] : t.planner.privacy}
            </p>

            {ready && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-base font-semibold text-zinc-950">{t.planner.question}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <WhereButton title={t.planner.onTheWay} hint={t.planner.onTheWayHint} onClick={() => choose("onTheWay")} />
                  <WhereButton
                    title={t.planner.atDestination}
                    hint={t.planner.atDestinationHint}
                    onClick={() => choose("atDestination")}
                  />
                </div>
              </fieldset>
            )}
          </section>
        ) : (
          <section aria-label={t.planner.title} className={`${PANEL} flex items-center justify-between gap-2`}>
            <p className="min-w-0 text-sm text-zinc-800">
              <span className="block truncate font-medium text-zinc-950">
                {origin.label} → {destination.label}
              </span>
              <span className="block text-xs text-zinc-600">
                {where === "onTheWay" ? t.planner.onTheWay : t.planner.atDestination}
                {where === "onTheWay" && onTheWay.route &&
                  ` · ${interpolate(t.planner.routeSummary, {
                    distance: formatDistance(onTheWay.route.distanceMeters),
                    duration: formatDuration(onTheWay.route.durationSeconds),
                  })}`}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-11 shrink-0 rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              {t.planner.change}
            </button>
          </section>
        )}

        <div className="mt-auto flex min-h-0 flex-col gap-2 sm:flex-1">
          {showing && (
            <div className="pointer-events-auto flex min-h-0 flex-col sm:flex-1 sm:justify-end">
              {where === "atDestination" ? (
                <NearbyList
                  title={interpolate(t.planner.atDestinationTitle, { place: destination.label })}
                  results={atDestination.ranked}
                  assumptions={atDestination.assumptions}
                  radiusKm={radiusKm}
                  onRadiusChange={setRadiusKm}
                  selectedId={selection?.id ?? null}
                  onSelect={selectFromList}
                />
              ) : onTheWay.routing ? (
                <p role="status" className={PANEL}>
                  {t.planner.routing}
                </p>
              ) : onTheWay.routeFailed ? (
                <p role="alert" className={`${PANEL} text-red-800`}>
                  {t.planner.routeUnavailable}
                </p>
              ) : (
                onTheWay.route && (
                  <RouteStationList
                    title={interpolate(t.planner.onTheWayTitle, { place: destination.label })}
                    results={onTheWay.ranked}
                    assumptions={onTheWay.assumptions}
                    selectedId={selection?.id ?? null}
                    onSelect={selectFromList}
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <StationSheet
          station={selected}
          fuel={fuel}
          onClose={closeSheet}
          // Kept on this device so "Continuer vers <destination>" is offered after the fill-up.
          onGo={() => destination && savePlannedDestination(destination)}
        />
      )}
    </main>
  );
}

function WhereButton({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-20 flex-col items-start justify-center rounded-xl border-2 border-blue-700 bg-blue-50 p-3 text-left text-blue-950 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
    >
      <span className="text-base font-semibold">{title}</span>
      <span className="text-xs">{hint}</span>
    </button>
  );
}

function BackToMap() {
  return (
    <Link href="/" className={LINK}>
      <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t.planner.backToMap}
    </Link>
  );
}
