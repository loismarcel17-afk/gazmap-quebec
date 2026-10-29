"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { fuelToParam } from "@/features/stations/fuel-param";
import { fetchPendingTrip, submitFillUp } from "@/lib/feedback-api";
import { interpolate, t } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/**
 * Next visit, less than 12 h after "J'y vais", no answer yet (the page was closed
 * on the way, or the trip went through Waze): "Avez-vous fait le plein chez X ?"
 */
export function PendingFillUpBanner() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.status === "signedIn" ? session.userId : null;
  const pending = useQuery({
    queryKey: ["pending-fill-up", userId],
    queryFn: fetchPendingTrip,
    enabled: userId !== null,
  });
  // "Masquer": hidden for this visit only; it comes back next time (within 12 h).
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const trip = pending.data;
  if (!trip || dismissed) return null;

  async function answerNo() {
    setBusy(true);
    try {
      await submitFillUp(trip!.tripId, { filled: false });
    } catch {
      // Not saved: just hide it for now; it may come back on the next visit.
    }
    setDismissed(true);
    void queryClient.invalidateQueries({ queryKey: ["pending-fill-up", userId] });
  }

  const href = `/retour/${trip.stationId}?${new URLSearchParams({ trajet: trip.tripId, carburant: fuelToParam(trip.fuel) })}`;

  return (
    <section
      aria-labelledby="pending-fill-up"
      className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="pending-fill-up" className="font-semibold text-zinc-950">
          {interpolate(t.feedback.prompt, { station: trip.label ?? t.station.unnamed })}
        </h2>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t.feedback.promptDismiss}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex gap-2">
        <Link
          href={href}
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {t.feedback.promptYes}
        </Link>
        <button
          type="button"
          onClick={() => void answerNo()}
          disabled={busy}
          className="min-h-11 flex-1 rounded-xl bg-zinc-100 px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-60"
        >
          {t.feedback.promptNo}
        </button>
      </div>
    </section>
  );
}
