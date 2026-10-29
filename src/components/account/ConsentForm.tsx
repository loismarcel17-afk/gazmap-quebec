"use client";

import Link from "next/link";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "./styles";

interface ConsentFormProps {
  /** Records both consents; rejects on failure */
  onAccept: (contributeToStatistics: boolean) => Promise<void>;
  /** Erases the just-created account; rejects on failure */
  onDecline: () => Promise<void>;
}

/**
 * Two separate consents (Loi 25): the terms (required) and anonymous statistics
 * (optional, UNCHECKED by default). Neither box is ever pre-checked.
 */
export function ConsentForm({ onAccept, onDecline }: ConsentFormProps) {
  const [terms, setTerms] = useState(false);
  const [statistics, setStatistics] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { terms: useId(), statistics: useId(), statisticsHelp: useId() };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!terms) {
      setError(t.account.consent.termsRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAccept(statistics);
    } catch {
      setError(t.account.consent.error);
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      await onDecline();
    } catch {
      setError(t.account.consent.declineError);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="consent-title" className="flex flex-col gap-5">
      <h2 id="consent-title" className="text-xl font-semibold text-zinc-950">
        {t.account.consent.title}
      </h2>

      <Checkbox id={ids.terms} checked={terms} onChange={setTerms} required>
        {withLink(t.account.consent.terms, "/legal/conditions", t.account.consent.termsLink)}
      </Checkbox>

      <div className="flex flex-col gap-1">
        <Checkbox id={ids.statistics} checked={statistics} onChange={setStatistics} describedBy={ids.statisticsHelp}>
          {t.account.consent.statistics}
        </Checkbox>
        <p id={ids.statisticsHelp} className="pl-10 text-sm text-zinc-600">
          {t.account.consent.statisticsHelp}
        </p>
      </div>

      <p className="text-sm text-zinc-700">
        {withLink(t.account.consent.privacy, "/legal/confidentialite", t.account.consent.privacyLink)}
      </p>

      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={BUTTON_PRIMARY}>
        {busy ? t.account.consent.saving : t.account.consent.continue}
      </button>
      <button type="button" onClick={() => void decline()} disabled={busy} className={`${BUTTON_SECONDARY} self-start`}>
        {t.account.consent.decline}
      </button>
    </form>
  );
}

function Checkbox({
  id,
  checked,
  onChange,
  required,
  describedBy,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        required={required}
        aria-describedby={describedBy}
        className="mt-0.5 size-7 shrink-0 accent-blue-700"
      />
      <label htmlFor={id} className="text-base text-zinc-900">
        {children}
      </label>
    </div>
  );
}

/** "J'accepte les {link}." → text with an inline link (the link opens in a new tab). */
function withLink(template: string, href: string, label: string): ReactNode {
  const [before, after] = template.split("{link}");
  return (
    <>
      {before}
      <Link href={href} target="_blank" className="font-medium text-blue-800 underline">
        {label}
      </Link>
      {after}
    </>
  );
}
