"use client";

import { useState } from "react";
import { formatDateTime, formatPrice } from "@/lib/format";
import { interpolate, t } from "@/lib/i18n";
import type { TripRecord } from "@/lib/trips-api";
import { BUTTON_SECONDARY } from "./styles";

interface TripHistoryProps {
  trips: TripRecord[] | undefined;
  failed: boolean;
  /** Deletes the whole history; rejects on failure */
  onClear: () => Promise<void>;
}

export function TripHistory({ trips, failed, onClear }: TripHistoryProps) {
  // Two steps to erase: a single stray tap must not delete data.
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);

  async function clear() {
    setBusy(true);
    setClearFailed(false);
    try {
      await onClear();
      setConfirming(false);
    } catch {
      setClearFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="trips-title" className="flex flex-col gap-3">
      <h2 id="trips-title" className="text-lg font-semibold text-zinc-950">
        {t.trips.title}
      </h2>
      <p className="text-sm text-zinc-600">{t.trips.noPosition}</p>

      {failed ? (
        <p role="alert" className="text-red-800">
          {t.trips.error}
        </p>
      ) : trips && trips.length === 0 ? (
        <p className="text-zinc-700">{t.trips.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {trips?.map((trip) => (
            <li key={trip.id} className="rounded-xl bg-zinc-100 p-3">
              <p className="flex justify-between gap-2">
                <span className="truncate font-medium text-zinc-950">
                  {trip.station?.brand ?? trip.station?.name ?? t.station.unnamed}
                </span>
                <span className="shrink-0 text-sm font-medium text-zinc-700">
                  {trip.mode === "external" ? "" : t.trips.status[trip.status]}
                </span>
              </p>
              <p className="truncate text-sm text-zinc-700">{trip.station?.address}</p>
              <p className="text-sm text-zinc-600">
                {formatDateTime(trip.startedAt)}
                {trip.priceAtStart !== null &&
                  ` · ${interpolate(t.trips.price, { fuel: t.fuel[trip.fuel], price: formatPrice(trip.priceAtStart) })}`}
              </p>
              {trip.mode === "external" && <p className="text-xs text-zinc-600">{t.trips.external}</p>}
            </li>
          ))}
        </ul>
      )}

      {trips && trips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => void clear()}
                disabled={busy}
                className={`${BUTTON_SECONDARY} bg-red-700 text-white hover:bg-red-800`}
              >
                {t.trips.confirmClear}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={BUTTON_SECONDARY}>
                {t.trips.cancelClear}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={BUTTON_SECONDARY}>
              {t.trips.clear}
            </button>
          )}
        </div>
      )}
      {clearFailed && (
        <p role="alert" className="text-sm text-red-800">
          {t.trips.clearError}
        </p>
      )}
    </section>
  );
}
