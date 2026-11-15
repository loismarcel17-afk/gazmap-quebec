"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { LatLng } from "@/features/geo/geo";
import { fuelToParam } from "@/features/stations/fuel-param";
import type { FuelType } from "@/features/stations/types";
import { t } from "@/lib/i18n";
import {
  createGuidanceController,
  type GuidanceController,
  type GuidanceDependencies,
  type GuidanceSnapshot,
} from "@/lib/navigation/guidance-controller";
import { watchPosition } from "@/lib/navigation/position-watch";
import { fetchDestinationRoute, fetchTripRoute } from "@/lib/navigation/route-api";
import { speak, stopSpeaking } from "@/lib/navigation/speech";
import { clearTrip, loadTrip, saveTrip } from "@/lib/navigation/trip-storage";
import { createScreenWakeLock, wakeLockSupported } from "@/lib/navigation/wake-lock";
import { clearPlannedDestination } from "@/lib/planned-trip";
import { endTrip, startTrip } from "@/lib/trips-api";

const noop = () => () => {};

/** In-site guidance needs both; otherwise the screen offers Waze / Google Maps. null = not known yet (server). */
export function useGuidanceSupported(): boolean | null {
  return useSyncExternalStore(
    noop,
    () => typeof navigator !== "undefined" && "geolocation" in navigator && wakeLockSupported(),
    () => null,
  );
}

/** Guidance to a station: "J'y vais". Arrival opens the feedback card. */
export function useGuidance(stationId: string, station: LatLng, fuel: FuelType): GuidanceHandle {
  const router = useRouter();
  return useGuidanceController(stationId, station, {
    fetchRoute: fetchTripRoute,
    onEnd: (reason, tripId) => {
      if (reason !== "arrived") return router.push("/");
      const query = new URLSearchParams({ carburant: fuelToParam(fuel) });
      if (tripId) query.set("trajet", tripId);
      router.push(`/retour/${stationId}?${query}`);
    },
    recordStart: () => startTrip(stationId, fuel, "guidance"),
    recordEnd: (tripId, status) => void endTrip(tripId, status),
  });
}

/** Key of the last leg in trip storage: it is not a station, so it can't clash with a station id. */
export const DESTINATION_TRIP_KEY = "destination";

/**
 * Last leg of a planned trip, after the fill-up: guidance to the user's own
 * destination. Not a fuel trip: nothing goes to the trip history. The planned
 * destination is forgotten on arrival and when the user stops.
 */
export function useDestinationGuidance(destination: LatLng, onArrived: () => void): GuidanceHandle {
  const router = useRouter();
  return useGuidanceController(DESTINATION_TRIP_KEY, destination, {
    fetchRoute: (origin, _key, heading) => fetchDestinationRoute(origin, destination, heading),
    onEnd: (reason) => {
      clearPlannedDestination();
      if (reason === "arrived") onArrived();
      else router.push("/");
    },
    recordStart: async () => null,
    recordEnd: () => {},
  });
}

interface GuidanceHandle {
  snapshot: GuidanceSnapshot;
  controller: GuidanceController;
}

type TargetDependencies = Pick<GuidanceDependencies, "fetchRoute" | "onEnd" | "recordStart" | "recordEnd">;

/** Connects the guidance controller (plain TS) to React and the real browser. */
function useGuidanceController(key: string, target: LatLng, targetDependencies: TargetDependencies): GuidanceHandle {
  // Created once per screen (useState initializer), with the real browser services.
  const [controller] = useState(() =>
    createGuidanceController(key, target, {
      ...targetDependencies,
      watchPosition,
      wakeLock: createScreenWakeLock(),
      speak,
      stopSpeaking,
      loadTrip: (id) => loadTrip(id),
      saveTrip,
      clearTrip,
      now: () => Date.now(),
      startedMessage: t.navigation.started,
    }),
  );

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  useEffect(() => {
    // The browser drops the wake lock when the page is hidden: ask again on return.
    const onVisibility = () => {
      if (document.visibilityState === "visible") controller.onVisible();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      // Leaving the screen: stop GPS and wake lock; the trip stays saved for resuming.
      controller.dispose();
    };
  }, [controller]);

  return { snapshot, controller };
}
