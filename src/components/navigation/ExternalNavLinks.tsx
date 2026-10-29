import type { LatLng } from "@/features/geo/geo";
import { appleMapsUrl, googleMapsUrl, wazeUrl } from "@/features/navigation/deep-links";
import { interpolate, t } from "@/lib/i18n";

const APPS = [
  { key: "waze", url: wazeUrl },
  { key: "google", url: googleMapsUrl },
  { key: "apple", url: appleMapsUrl },
] as const;

/** "Open in Waze / Google Maps / Plans": always offered, and the fallback. */
export function ExternalNavLinks({
  destination,
  apps = ["waze", "google"],
  onOpen,
}: {
  destination: LatLng;
  apps?: ("waze" | "google" | "apple")[];
  /** Called when a link is followed (e.g. to record the trip) */
  onOpen?: () => void;
}) {
  return (
    <div className="flex gap-2">
      {APPS.filter((app) => apps.includes(app.key)).map((app) => (
        <a
          key={app.key}
          href={app.url(destination)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
          className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-zinc-100 px-3 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          {interpolate(t.navigation.openIn, { app: t.navigation.apps[app.key] })}
        </a>
      ))}
    </div>
  );
}
