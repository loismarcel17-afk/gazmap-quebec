"use client";

import { useEffect, useRef, useState } from "react";
import type { ConsentSummary } from "@/features/account/consents";
import { formatDateTime } from "@/lib/format";
import { interpolate, t } from "@/lib/i18n";
import { BUTTON_DANGER, BUTTON_DANGER_SOFT, BUTTON_SECONDARY } from "./styles";

interface AccountSettingsProps {
  email: string;
  consents: ConsentSummary;
  /** Records a new statistics consent row; rejects on failure */
  onStatisticsChange: (granted: boolean) => Promise<void>;
  onSignOut: () => void;
}

export function AccountSettings({ email, consents, onStatisticsChange, onSignOut }: AccountSettingsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggleStatistics() {
    setBusy(true);
    setError(false);
    try {
      await onStatisticsChange(!consents.statistics);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const statisticsStatus = consents.statistics
    ? interpolate(t.account.settings.statisticsOn, { date: formatDateTime(consents.statisticsChangedAt!) })
    : consents.statisticsChangedAt
      ? interpolate(t.account.settings.statisticsOffSince, { date: formatDateTime(consents.statisticsChangedAt) })
      : t.account.settings.statisticsOff;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-zinc-800">{interpolate(t.account.settings.signedInAs, { email })}</p>

      <section aria-labelledby="consents-title" className="flex flex-col gap-3">
        <h2 id="consents-title" className="text-lg font-semibold text-zinc-950">
          {t.account.settings.consentsTitle}
        </h2>
        {consents.termsAcceptedAt && (
          <p className="text-sm text-zinc-700">
            {interpolate(t.account.settings.termsAccepted, { date: formatDateTime(consents.termsAcceptedAt) })}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 rounded-xl bg-zinc-100 p-3">
          <div>
            <p id="statistics-label" className="font-medium text-zinc-950">
              {t.account.settings.statistics}
            </p>
            <p className="text-sm text-zinc-700" aria-live="polite">
              {statisticsStatus}
            </p>
          </div>
          {/* A switch: role="switch" + aria-checked tell screen readers it's on/off. */}
          <button
            type="button"
            role="switch"
            aria-checked={consents.statistics}
            aria-labelledby="statistics-label"
            onClick={() => void toggleStatistics()}
            disabled={busy}
            className="relative h-8 w-14 shrink-0 rounded-full bg-zinc-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60 aria-checked:bg-blue-700"
          >
            <span
              aria-hidden
              className={`absolute top-1 size-6 rounded-full bg-white shadow transition-transform ${consents.statistics ? "translate-x-7" : "translate-x-1"}`}
            />
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-800">
            {t.account.settings.statisticsError}
          </p>
        )}
      </section>

      <button type="button" onClick={onSignOut} className={`${BUTTON_SECONDARY} self-start`}>
        {t.account.settings.signOut}
      </button>
    </div>
  );
}

/**
 * Last on the page, two steps, so a stray tap never deletes an account.
 * `onDelete` deletes the account and all its data; rejects on failure.
 */
export function DeleteAccount({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const confirmTitle = useRef<HTMLHeadingElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  // Keyboard and screen-reader users land on the question, then back on the
  // button if they cancel.
  useEffect(() => {
    if (confirming) confirmTitle.current?.focus();
    else if (opened.current) openButton.current?.focus();
    opened.current = confirming;
  }, [confirming]);

  async function confirm() {
    setBusy(true);
    setError(false);
    try {
      await onDelete();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="delete-title" className="flex flex-col gap-3 border-t border-zinc-200 pt-6">
      <h2 id="delete-title" className="text-lg font-semibold text-zinc-950">
        {t.account.settings.deleteTitle}
      </h2>
      <p className="text-sm text-zinc-700">{t.account.settings.deleteIntro}</p>

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-red-700 p-4">
          <h3 ref={confirmTitle} tabIndex={-1} className="font-semibold text-zinc-950 focus:outline-none">
            {t.account.settings.deleteConfirmTitle}
          </h3>
          <p className="text-sm text-zinc-700">{t.account.settings.deleteConfirmText}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void confirm()} disabled={busy} className={BUTTON_DANGER}>
              {busy ? t.account.settings.deleting : t.account.settings.deleteConfirm}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={BUTTON_SECONDARY}>
              {t.account.settings.deleteCancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={openButton}
          type="button"
          onClick={() => setConfirming(true)}
          className={`${BUTTON_DANGER_SOFT} self-start`}
        >
          {t.account.settings.delete}
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-800">
          {t.account.settings.deleteError}
        </p>
      )}
    </section>
  );
}
