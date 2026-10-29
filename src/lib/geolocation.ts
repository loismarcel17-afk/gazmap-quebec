import type { LatLng } from "@/features/geo/geo";

export type GeolocationFailureReason = "unsupported" | "denied" | "unavailable";

export class GeolocationFailure extends Error {
  constructor(readonly reason: GeolocationFailureReason) {
    super(`Geolocation failed: ${reason}`);
  }
}

/**
 * One-shot position, only when the user asks (Loi 25: never on page load).
 * The position stays in memory on the device: it is not stored nor sent anywhere.
 */
// `null` (not undefined) means "no geolocation": a default parameter would replace undefined.
export function getCurrentPosition(
  geolocation: Geolocation | null = globalThis.navigator?.geolocation ?? null,
): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new GeolocationFailure("unsupported"));
      return;
    }
    geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      // error.code: 1 = permission denied, 2 = position unavailable, 3 = timeout
      (error) => reject(new GeolocationFailure(error.code === 1 ? "denied" : "unavailable")),
      {
        // City-level precision is enough to list nearby stations: answers faster, saves battery.
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  });
}
