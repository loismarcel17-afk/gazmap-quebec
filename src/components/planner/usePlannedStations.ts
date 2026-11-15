"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { LatLng } from "@/features/geo/geo";
import { rankAlongRoute, type RankedStation } from "@/features/recommendation/rank";
import { stationsAlongRoute } from "@/features/routing/corridor";
import { MAX_ROUTE_CANDIDATES } from "@/features/routing/route-matrix";
import type { FuelType, Station } from "@/features/stations/types";
import { fetchPlannedRoute, fetchRouteDetours, type PlannedRoute } from "@/lib/planner-api";
import type { FillUpAssumptions } from "../NearbyList";
import { useFillUpVehicle } from "../useRankedStations";

/** A route doesn't change within a visit: don't ask Mapbox twice for the same trip. */
const ROUTE_STALE_MS = 30 * 60 * 1000;

// Rounded to ~10 m: the same trip asked twice hits the cache, not Mapbox.
const key = (point: LatLng | null) => (point ? `${point.lat.toFixed(4)},${point.lng.toFixed(4)}` : null);

export interface PlannedStations {
  route: PlannedRoute | null;
  /** The route is being computed */
  routing: boolean;
  /** No route (Mapbox down, no road, offline) */
  routeFailed: boolean;
  /** Stations along the route, by total cost; empty until the route is known */
  ranked: RankedStation[];
  assumptions: FillUpAssumptions;
}

/**
 * The route A → B (once both are known), then the stations along it ranked by
 * total fill-up cost. Same three steps as useRankedStations:
 * 1. estimate each detour from the distance to the line (instant);
 * 2. ask the road detour A → station → B for the 23 best estimates;
 * 3. rank again with them.
 */
export function usePlannedStations(
  stations: Station[],
  origin: LatLng | null,
  destination: LatLng | null,
  fuel: FuelType,
): PlannedStations {
  const { vehicle, assumptions } = useFillUpVehicle();

  const routeQuery = useQuery({
    queryKey: ["planned-route", key(origin), key(destination)],
    queryFn: () => fetchPlannedRoute(origin!, destination!),
    enabled: origin !== null && destination !== null,
    staleTime: ROUTE_STALE_MS,
    retry: false,
  });
  const route = routeQuery.data ?? null;

  const along = useMemo(
    () => (route ? stationsAlongRoute(stations, route.geometry, fuel) : []),
    [stations, route, fuel],
  );
  const preliminary = useMemo(() => rankAlongRoute(along, vehicle), [along, vehicle]);
  const candidates = useMemo(
    () => preliminary.slice(0, MAX_ROUTE_CANDIDATES).map((entry) => entry.station),
    [preliminary],
  );

  const detours = useQuery({
    queryKey: ["route-detours", key(origin), key(destination), candidates.map((station) => station.id).join(",")],
    queryFn: () => fetchRouteDetours(origin!, destination!, candidates),
    enabled: route !== null && candidates.length > 0,
    staleTime: ROUTE_STALE_MS,
    retry: false,
  });

  const ranked = useMemo(
    () => (detours.data ? rankAlongRoute(along, vehicle, detours.data) : preliminary),
    [detours.data, along, vehicle, preliminary],
  );

  return {
    route,
    routing: routeQuery.isFetching,
    routeFailed: routeQuery.isSuccess && route === null,
    ranked,
    assumptions,
  };
}
