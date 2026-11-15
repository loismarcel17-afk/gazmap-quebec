"use client";

import Link from "next/link";
import { useState } from "react";
import { interpolate, t } from "@/lib/i18n";
import { usePlannedDestination, type PlannedDestination } from "@/lib/planned-trip";
import { useSession } from "@/lib/session";
import { BIG_BUTTON, CenteredMessage, GuidanceView } from "./TripScreen";
import { useDestinationGuidance } from "./useGuidance";

/**
 * /destination: last leg of a planned trip (PLAN.md task 18). The destination
 * comes from this device's storage, never from the URL: an address in a URL
 * ends up in browser history and server logs.
 */
export function DestinationScreen() {
  const destination = usePlannedDestination();
  const session = useSession();
  const [arrived, setArrived] = useState(false);

  if (arrived) {
    return (
      <CenteredMessage>
        <p className="text-2xl font-semibold text-zinc-950">{t.planner.arrived}</p>
        <Link href="/" className={`${BIG_BUTTON} mt-6 bg-zinc-900 text-white`}>
          {t.feedback.backToMap}
        </Link>
      </CenteredMessage>
    );
  }
  if (destination === undefined || session.status === "loading") {
    return <CenteredMessage>{t.navigation.loading}</CenteredMessage>;
  }
  // No plan (expired, other device) or signed out (the route is account-only): plan again.
  if (destination === null || session.status === "signedOut") {
    return (
      <CenteredMessage>
        <p>{session.status === "signedOut" ? t.planner.signInRequired : t.planner.intro}</p>
        <Link href="/planifier" className={`${BIG_BUTTON} mt-4 bg-blue-700 text-white`}>
          {t.planner.title}
        </Link>
      </CenteredMessage>
    );
  }
  return <DestinationGuidance destination={destination} onArrived={() => setArrived(true)} />;
}

function DestinationGuidance({ destination, onArrived }: { destination: PlannedDestination; onArrived: () => void }) {
  const { snapshot, controller } = useDestinationGuidance(destination, onArrived);
  return (
    <GuidanceView
      title={interpolate(t.planner.destinationTitle, { place: destination.label })}
      target={destination}
      snapshot={snapshot}
      controller={controller}
    />
  );
}
