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
  type GuidanceSnapshot,
} from "@/lib/navigation/guidance-controller";
import { watchPosition } from "@/lib/navigation/position-watch";
import { fetchTripRoute } from "@/lib/navigation/route-api";
import { speak, stopSpeaking } from "@/lib/navigation/speech";
import { clearTrip, loadTrip, saveTrip } from "@/lib/navigation/trip-storage";
import { createScreenWakeLock, wakeLockSupported } from "@/lib/navigation/wake-lock";
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

/** Connects the guidance controller (plain TS) to React and the real browser. */
export function useGuidance(stationId: string, station: LatLng, fuel: FuelType): {
  snapshot: GuidanceSnapshot;
  controller: GuidanceController;
} {
  const router = useRouter();
  // Created once per screen (useState initializer), with the real browser services.
  const [controller] = useState(() =>
    createGuidanceController(stationId, station, {
      watchPosition,
      fetchRoute: fetchTripRoute,
      wakeLock: createScreenWakeLock(),
      speak,
      stopSpeaking,
      loadTrip: (id) => loadTrip(id),
      saveTrip,
      clearTrip,
      now: () => Date.now(),
      onEnd: (reason, tripId) => {
        if (reason !== "arrived") return router.push("/");
        const query = new URLSearchParams({ carburant: fuelToParam(fuel) });
        if (tripId) query.set("trajet", tripId);
        router.push(`/retour/${stationId}?${query}`);
      },
      startedMessage: t.navigation.started,
      recordStart: () => startTrip(stationId, fuel, "guidance"),
      recordEnd: (tripId, status) => void endTrip(tripId, status),
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
