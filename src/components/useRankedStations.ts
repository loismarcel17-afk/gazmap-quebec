"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { LatLng } from "@/features/geo/geo";
import { consumption, litresToBuy } from "@/features/recommendation/fill-up-cost";
import { rankByTotalCost, type RankedStation } from "@/features/recommendation/rank";
import { MAX_DESTINATIONS } from "@/features/routing/matrix";
import type { NearbyStation } from "@/features/stations/nearby";
import { vehicleInput } from "@/features/vehicle/profile";
import { fetchRoadDistances } from "@/lib/road-distances";
import { useVehicleStore } from "@/lib/vehicle-store";
import type { FillUpAssumptions } from "./NearbyList";

/** Road distances don't change within a visit; prices do, but they're not in this request. */
const ROAD_DISTANCES_STALE_MS = 10 * 60 * 1000;

/**
 * Nearby stations ranked by total fill-up cost for the user's vehicle.
 *
 * 1. Rank once with straight-line detours (instant, on the phone).
 * 2. Ask road distances for the 24 best candidates (one Mapbox Matrix call).
 * 3. Rank again with them; until they arrive (or without a Mapbox token) the
 *    straight-line ranking is shown.
 */
export function useRankedStations(
  nearby: NearbyStation[],
  origin: LatLng | null,
): { ranked: RankedStation[]; assumptions: FillUpAssumptions } {
  // Select each field: a fresh object from the selector would re-render on every store change.
  const model = useVehicleStore((state) => state.model);
  const tankCapacityL = useVehicleStore((state) => state.tankCapacityL);
  const currentLevel = useVehicleStore((state) => state.currentLevel);
  const vehicle = useMemo(
    () => vehicleInput({ model, tankCapacityL, currentLevel }),
    [model, tankCapacityL, currentLevel],
  );

  const preliminary = useMemo(() => rankByTotalCost(nearby, vehicle), [nearby, vehicle]);
  const candidates = useMemo(() => preliminary.slice(0, MAX_DESTINATIONS).map((entry) => entry.station), [preliminary]);

  const road = useQuery({
    queryKey: ["road-distances", origin?.lat, origin?.lng, candidates.map((station) => station.id).join(",")],
    queryFn: () => fetchRoadDistances(origin!, candidates),
    enabled: origin !== null && candidates.length > 0,
    staleTime: ROAD_DISTANCES_STALE_MS,
    retry: false, // null already means "unavailable": fall back, don't insist
  });

  const ranked = useMemo(
    () => (road.data ? rankByTotalCost(nearby, vehicle, road.data) : preliminary),
    [road.data, nearby, vehicle, preliminary],
  );

  const assumptions = useMemo<FillUpAssumptions>(
    () => ({
      litres: litresToBuy(vehicle),
      consumptionLPer100Km: consumption(vehicle),
      hasVehicle: model !== null || tankCapacityL !== null,
    }),
    [vehicle, model, tankCapacityL],
  );

  return { ranked, assumptions };
}
