"use client";

import { useId, useState, type FormEvent } from "react";
import { normalizeEmail } from "@/features/account/consents";
import { sendSignInCode, verifySignInCode, type SignInError } from "@/lib/account-api";
import { interpolate, t } from "@/lib/i18n";
import { useTurnstile } from "@/lib/turnstile";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD } from "./styles";

/** Sign-in without password: e-mail → 6-digit code → signed in (account created on first use). */
export function SignInForm() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [emailText, setEmailText] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { email: useId(), code: useId(), message: useId() };
  const { attach: attachTurnstile, getToken: getCaptchaToken } = useTurnstile();

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    const normalized = normalizeEmail(emailText);
    if (!normalized) {
      setError(t.account.signIn.emailInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    let captchaToken: string | null;
    try {
      captchaToken = await getCaptchaToken();
    } catch {
      setBusy(false);
      setError(t.account.signIn.errors.captcha);
      return;
    }
    const failure = await sendSignInCode(normalized, captchaToken);
    setBusy(false);
    if (failure) {
      setError(t.account.signIn.errors[failure]);
      return;
    }
    setEmail(normalized);
    setCode("");
    setStep("code");
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t.account.signIn.codeInvalidFormat);
      return;
    }
    setBusy(true);
    setError(null);
    const failure: SignInError | null = await verifySignInCode(email, code);
    setBusy(false);
    // On success the session hook switches the page to the next step by itself.
    if (failure) setError(t.account.signIn.errors[failure]);
  }

  return (
    <section aria-labelledby="sign-in-title" className="flex flex-col gap-4">
      <h2 id="sign-in-title" className="text-xl font-semibold text-zinc-950">
        {t.account.signIn.title}
      </h2>

      {step === "email" ? (
        <form onSubmit={requestCode} noValidate className="flex flex-col gap-3">
          <label htmlFor={ids.email} className="font-medium text-zinc-900">
            {t.account.signIn.email}
          </label>
          <input
            id={ids.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={emailText}
            onChange={(event) => setEmailText(event.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? ids.message : undefined}
            className={FIELD}
          />
          <button type="submit" disabled={busy} className={BUTTON_PRIMARY}>
            {busy ? t.account.signIn.sending : t.account.signIn.send}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate className="flex flex-col gap-3">
          <p className="text-zinc-800" aria-live="polite">
            {interpolate(t.account.signIn.codeSent, { email })}
          </p>
          <label htmlFor={ids.code} className="font-medium text-zinc-900">
            {t.account.signIn.code}
          </label>
          <input
            id={ids.code}
            // one-time-code: phones offer to fill in the code from the e-mail / SMS.
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            aria-invalid={error !== null}
            aria-describedby={error ? ids.message : undefined}
            className={`${FIELD} text-center text-2xl tracking-[0.5em] tabular-nums`}
          />
          <button type="submit" disabled={busy} className={BUTTON_PRIMARY}>
            {busy ? t.account.signIn.verifying : t.account.signIn.verify}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void requestCode()} disabled={busy} className={BUTTON_SECONDARY}>
              {t.account.signIn.resend}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className={BUTTON_SECONDARY}
            >
              {t.account.signIn.otherEmail}
            </button>
          </div>
        </form>
      )}

      {/* Anti-robot check (Turnstile): shows only when Cloudflare needs a click.
          Outside the steps, so "Renvoyer un code" gets a token too. */}
      <div ref={attachTurnstile} className="empty:hidden" />

      {error && (
        <p id={ids.message} role="alert" className="text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}
