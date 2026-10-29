// Links that open the trip in a navigation app (always offered, and the fallback
// when in-site guidance isn't possible). Only the destination is in the link.
import type { LatLng } from "@/features/geo/geo";

const coords = ({ lat, lng }: LatLng) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

export function wazeUrl(destination: LatLng): string {
  return `https://waze.com/ul?ll=${coords(destination)}&navigate=yes`;
}

export function googleMapsUrl(destination: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coords(destination)}&travelmode=driving`;
}

export function appleMapsUrl(destination: LatLng): string {
  return `https://maps.apple.com/?daddr=${coords(destination)}&dirflg=d`;
}
