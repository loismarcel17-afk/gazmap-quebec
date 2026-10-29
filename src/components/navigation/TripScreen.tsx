"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { LatLng } from "@/features/geo/geo";
import type { FuelType } from "@/features/stations/types";
import { maneuverIcon } from "@/features/navigation/maneuver-icon";
import { formatClock, formatDistance, formatDuration } from "@/lib/format";
import { interpolate, t } from "@/lib/i18n";
import type { FallbackReason, GuidanceSnapshot } from "@/lib/navigation/guidance-controller";
import { fetchStationLocation } from "@/lib/station-location";
import { startTrip } from "@/lib/trips-api";
import { ExternalNavLinks } from "./ExternalNavLinks";
import { ManeuverBanner } from "./ManeuverBanner";
import { useGuidance, useGuidanceSupported } from "./useGuidance";

// MapLibre needs the browser: client-only, in its own chunk.
const GuidanceMap = dynamic(() => import("./GuidanceMap"), { ssr: false });

const BIG_BUTTON =
  "flex min-h-14 items-center justify-center rounded-2xl px-5 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export function TripScreen({ stationId, fuel }: { stationId: string; fuel: FuelType }) {
  const station = useQuery({
    queryKey: ["station-location", stationId],
    queryFn: () => fetchStationLocation(stationId),
    staleTime: Infinity,
  });

  if (station.isPending) return <CenteredMessage>{t.navigation.loading}</CenteredMessage>;
  if (!station.data) {
    return (
      <CenteredMessage>
        <p>{t.navigation.notFound}</p>
        <Link href="/" className={`${BIG_BUTTON} mt-4 bg-zinc-900 text-white`}>
          {t.feedback.backToMap}
        </Link>
      </CenteredMessage>
    );
  }
  const { lat, lng, name, brand } = station.data;
  return <Guidance stationId={stationId} station={{ lat, lng }} fuel={fuel} label={brand ?? name ?? t.station.unnamed} />;
}

function Guidance({
  stationId,
  station,
  fuel,
  label,
}: {
  stationId: string;
  station: LatLng;
  fuel: FuelType;
  label: string;
}) {
  const supported = useGuidanceSupported();
  const { snapshot, controller } = useGuidance(stationId, station, fuel);
  // "J'y vais" through Waze / Google Maps: recorded for signed-in users (fire and forget).
  const recordExternalTrip = () => void startTrip(stationId, fuel, "external");
  const fallback: FallbackReason | null = supported === false ? "unsupported" : snapshot.fallbackReason;
  const driving = !fallback && snapshot.phase !== "notice";

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-zinc-200">
      <h1 className="sr-only">{interpolate(t.navigation.title, { station: label })}</h1>

      <GuidanceMap
        station={station}
        geometry={snapshot.geometry}
        position={snapshot.position}
        bearing={snapshot.bearing}
        follow={snapshot.phase === "guiding"}
      />

      {driving && (
        <div className="absolute inset-x-3 top-3 z-10 flex flex-col gap-2">
          {snapshot.phase === "guiding" && snapshot.progress && <NextManeuver snapshot={snapshot} />}
          <StatusLine snapshot={snapshot} />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-white p-4 pb-6 shadow-2xl">
        {fallback ? (
          <FallbackPanel reason={fallback} station={station} onOpenApp={recordExternalTrip} />
        ) : snapshot.phase === "notice" ? (
          <SafetyNotice
            label={label}
            resumable={snapshot.resumable}
            onStart={() => void controller.start()}
            station={station}
            onOpenApp={recordExternalTrip}
          />
        ) : (
          <TripPanel
            snapshot={snapshot}
            station={station}
            onStop={controller.stop}
            onToggleMute={controller.toggleMute}
          />
        )}
      </div>
    </main>
  );
}

function NextManeuver({ snapshot }: { snapshot: GuidanceSnapshot }) {
  const progress = snapshot.progress!;
  const next = progress.nextManeuver;
  return (
    <ManeuverBanner
      icon={maneuverIcon(next?.maneuver ?? { type: "continue", modifier: "straight" })}
      distance={formatDistance(progress.distanceToManeuver)}
      street={next?.text ?? ""}
    />
  );
}

function StatusLine({ snapshot }: { snapshot: GuidanceSnapshot }) {
  const messages = [
    snapshot.phase === "locating" && t.navigation.status.locating,
    snapshot.phase === "routing" && t.navigation.status.routing,
    snapshot.rerouting && t.navigation.status.rerouting,
    snapshot.weakGps && t.navigation.status.weakGps,
    snapshot.wakeLockRefused && t.navigation.status.wakeLockRefused,
  ].filter((message): message is string => Boolean(message));
  if (messages.length === 0) return null;
  return (
    <p role="status" className="self-start rounded-xl bg-amber-100 px-3 py-2 text-base font-medium text-amber-950 shadow">
      {messages.join(" · ")}
    </p>
  );
}

/** Short, non-blocking safety message before starting (CLAUDE.md, Code de la sécurité routière). */
function SafetyNotice({
  label,
  resumable,
  onStart,
  station,
  onOpenApp,
}: {
  label: string;
  resumable: boolean;
  onStart: () => void;
  station: LatLng;
  onOpenApp: () => void;
}) {
  return (
    <section aria-labelledby="safety-title" className="flex flex-col gap-3">
      <p className="text-sm font-medium text-zinc-600">{interpolate(t.navigation.title, { station: label })}</p>
      <h2 id="safety-title" className="text-xl font-bold text-zinc-950">
        {t.navigation.safety.title}
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-zinc-800">
        <li>{t.navigation.safety.screen}</li>
        <li>{t.navigation.safety.phone}</li>
      </ul>
      <button type="button" onClick={onStart} className={`${BIG_BUTTON} bg-blue-700 text-white hover:bg-blue-800`}>
        {resumable ? t.navigation.safety.resume : t.navigation.safety.start}
      </button>
      <ExternalNavLinks destination={station} onOpen={onOpenApp} />
    </section>
  );
}

function TripPanel({
  snapshot,
  station,
  onStop,
  onToggleMute,
}: {
  snapshot: GuidanceSnapshot;
  station: LatLng;
  onStop: () => void;
  onToggleMute: () => void;
}) {
  const { progress } = snapshot;
  return (
    <section aria-label={t.navigation.remaining} className="flex flex-col gap-3">
      {progress && (
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Figure label={t.navigation.remaining} value={formatDuration(progress.remainingSeconds)} />
          <Figure label={t.navigation.distanceLeft} value={formatDistance(progress.remainingMeters)} />
          <Figure
            label={t.navigation.arrival}
            value={snapshot.arrivalAt ? formatClock(new Date(snapshot.arrivalAt)) : "–"}
          />
        </dl>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          aria-pressed={snapshot.muted}
          aria-label={snapshot.muted ? t.navigation.unmute : t.navigation.mute}
          className={`${BIG_BUTTON} bg-zinc-100 text-zinc-900`}
        >
          <SpeakerIcon muted={snapshot.muted} />
        </button>
        <button type="button" onClick={onStop} className={`${BIG_BUTTON} flex-1 bg-red-700 text-white hover:bg-red-800`}>
          {t.navigation.stop}
        </button>
      </div>
      <ExternalNavLinks destination={station} />
    </section>
  );
}

function FallbackPanel({
  reason,
  station,
  onOpenApp,
}: {
  reason: FallbackReason;
  station: LatLng;
  onOpenApp: () => void;
}) {
  return (
    <section role="alert" className="flex flex-col gap-3">
      <p className="text-lg font-semibold text-zinc-950">{t.navigation.fallback[reason]}</p>
      <p className="text-zinc-700">{t.navigation.fallback.useApp}</p>
      <ExternalNavLinks destination={station} apps={["waze", "google", "apple"]} onOpen={onOpenApp} />
      <Link href="/" className={`${BIG_BUTTON} bg-zinc-900 text-white`}>
        {t.feedback.backToMap}
      </Link>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-600 uppercase">{label}</dt>
      <dd className="text-2xl font-bold text-zinc-950 tabular-nums">{value}</dd>
    </div>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
      {muted ? <path d="M17 9l5 6M22 9l-5 6" strokeLinecap="round" /> : <path d="M17 8a5 5 0 0 1 0 8M19.5 5.5a8.5 8.5 0 0 1 0 13" strokeLinecap="round" />}
    </svg>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center p-6 text-center text-lg text-zinc-800">
      {children}
    </main>
  );
}
