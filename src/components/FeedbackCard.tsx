"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { formatPriceInput, parsePriceInput } from "@/features/feedback/price-input";
import { FUEL_TYPES, type FuelType } from "@/features/stations/types";
import { fetchStationPrices, submitFillUp, type FillUpAnswer } from "@/lib/feedback-api";
import { formatPrice } from "@/lib/format";
import { interpolate, t } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type Step = "question" | "details" | "thanksYes" | "thanksNo";

const BIG = "min-h-14 rounded-2xl text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60";
const PRIMARY = `${BIG} bg-blue-700 text-white hover:bg-blue-800`;
const SECONDARY = `${BIG} bg-zinc-100 text-zinc-900 hover:bg-zinc-200`;

/**
 * After-fill-up card, opened on arrival (guidance) or from the next-visit prompt.
 * With a trip of a signed-in user, the answer is saved (once per trip);
 * otherwise it just thanks and invites to create an account.
 */
export function FeedbackCard({
  stationId,
  tripId,
  initialFuel,
}: {
  stationId: string;
  tripId: string | null;
  initialFuel: FuelType;
}) {
  const session = useSession();
  const station = useQuery({
    queryKey: ["station-prices", stationId],
    queryFn: () => fetchStationPrices(stationId),
  });
  const [step, setStep] = useState<Step>("question");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = station.data?.brand ?? station.data?.name ?? t.station.unnamed;
  // Saved only for a signed-in user's trip.
  const canSave = tripId !== null && session.status === "signedIn";

  async function save(answer: FillUpAnswer) {
    if (!canSave) {
      setStep(answer.filled ? "thanksYes" : "thanksNo");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitFillUp(tripId, answer);
      setStep(answer.filled ? "thanksYes" : "thanksNo");
    } catch (failure) {
      // 23505 = unique violation: this trip already has an answer.
      setError((failure as { code?: string }).code === "23505" ? t.feedback.alreadyAnswered : t.feedback.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 p-6">
      <p className="text-sm font-semibold tracking-wide text-blue-800 uppercase">{t.feedback.arrived}</p>

      {step === "question" && (
        <section aria-labelledby="feedback-question" className="flex flex-col gap-4">
          <h1 id="feedback-question" className="text-3xl font-bold text-zinc-950">
            {interpolate(t.feedback.question, { station: label })}
          </h1>
          <div className="flex gap-3">
            <button
              type="button"
              // Without an account there's nothing to save: thank right away.
              onClick={() => setStep(canSave ? "details" : "thanksYes")}
              className={`${PRIMARY} flex-1`}
            >
              {t.feedback.yes}
            </button>
            <button type="button" onClick={() => void save({ filled: false })} disabled={busy} className={`${SECONDARY} flex-1`}>
              {t.feedback.no}
            </button>
          </div>
        </section>
      )}

      {step === "details" && (
        <FillUpDetails
          label={label}
          initialFuel={initialFuel}
          prices={station.data?.prices ?? null}
          busy={busy}
          onSubmit={(fuel, pricePaid) => void save({ filled: true, fuel, pricePaid })}
        />
      )}

      {(step === "thanksYes" || step === "thanksNo") && (
        <section aria-live="polite" className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-zinc-950">{t.feedback.thanks}</h1>
          <p className="text-lg text-zinc-700">{step === "thanksYes" && canSave ? t.feedback.thanksYes : t.feedback.thanksNo}</p>
          {!canSave && step === "thanksYes" && (
            <p className="text-zinc-700">
              {t.feedback.accountInvite}{" "}
              <Link href="/compte" className="font-medium text-blue-800 underline">
                {t.feedback.accountLink}
              </Link>
            </p>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}

      <Link
        href="/"
        className="flex min-h-12 items-center self-start rounded-full font-medium text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700"
      >
        {t.feedback.backToMap}
      </Link>
    </main>
  );
}

/** Fuel (pre-selected) + price paid (pre-filled with the displayed price): one tap when it matches. */
function FillUpDetails({
  label,
  initialFuel,
  prices,
  busy,
  onSubmit,
}: {
  label: string;
  initialFuel: FuelType;
  prices: Record<FuelType, number | null> | null;
  busy: boolean;
  onSubmit: (fuel: FuelType, pricePaid: number) => void;
}) {
  const [fuel, setFuel] = useState<FuelType>(initialFuel);
  const displayed = prices?.[fuel] ?? null;
  // null = untouched: follow the displayed price of the selected fuel.
  const [typed, setTyped] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const ids = { price: useId(), hint: useId() };
  const text = typed ?? (displayed !== null ? formatPriceInput(displayed) : "");

  function submit(event: FormEvent) {
    event.preventDefault();
    const tenths = parsePriceInput(text);
    if (tenths === null) {
      setInvalid(true);
      return;
    }
    onSubmit(fuel, tenths);
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="details-title" className="flex flex-col gap-5">
      <h1 id="details-title" className="text-2xl font-bold text-zinc-950">
        {interpolate(t.feedback.question, { station: label })}
      </h1>

      <div role="group" aria-labelledby="fuel-label" className="flex flex-col gap-2">
        <span id="fuel-label" className="font-semibold text-zinc-950">
          {t.feedback.fuel}
        </span>
        <div className="flex gap-2">
          {FUEL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={type === fuel}
              onClick={() => {
                setFuel(type);
                setTyped(null); // show that fuel's displayed price
                setInvalid(false);
              }}
              className="min-h-12 flex-1 rounded-xl bg-zinc-100 font-medium text-zinc-800 focus-visible:outline-2 focus-visible:outline-blue-700 aria-pressed:bg-zinc-900 aria-pressed:text-white"
            >
              {t.fuel[type]}
            </button>
          ))}
        </div>
      </div>

      {displayed !== null && typed === null && (
        <button type="button" onClick={() => onSubmit(fuel, displayed)} disabled={busy} className={PRIMARY}>
          {interpolate(t.feedback.sameAsDisplayed, { price: formatPrice(displayed) })}
        </button>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={ids.price} className="font-semibold text-zinc-950">
          {t.feedback.price}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={ids.price}
            inputMode="decimal"
            value={text}
            onChange={(event) => {
              setTyped(event.target.value);
              setInvalid(false);
            }}
            aria-invalid={invalid}
            aria-describedby={ids.hint}
            className="min-h-12 w-32 rounded-lg border border-zinc-300 px-3 text-xl text-zinc-950 tabular-nums aria-invalid:border-red-700 focus-visible:outline-2 focus-visible:outline-blue-700"
          />
          <span className="text-zinc-700">{t.feedback.priceUnit}</span>
        </div>
        <p id={ids.hint} className={`text-sm ${invalid ? "text-red-800" : "text-zinc-600"}`}>
          {invalid ? t.feedback.priceInvalid : t.feedback.priceHint}
        </p>
      </div>

      <button type="submit" disabled={busy} className={typed === null && displayed !== null ? SECONDARY : PRIMARY}>
        {busy ? t.feedback.saving : t.feedback.confirm}
      </button>
    </form>
  );
}
