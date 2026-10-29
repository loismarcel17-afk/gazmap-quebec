import { initialConsentRows, type ConsentKind, type ConsentState } from "@/features/account/consents";
import { clearTrip } from "./navigation/trip-storage";
import { supabase } from "./supabase";

export type SignInError = "rateLimited" | "invalidCode" | "captcha" | "unavailable";

/** Maps Supabase Auth errors to what the user can act on. Never logs the e-mail. */
function signInError(error: { status?: number; code?: string }): SignInError {
  if (error.status === 429 || error.code?.includes("rate_limit")) return "rateLimited";
  if (error.code === "captcha_failed") return "captcha";
  if (error.code === "otp_expired" || error.code === "invalid_credentials" || error.status === 403) {
    return "invalidCode";
  }
  return "unavailable";
}

/**
 * Sends a 6-digit code by e-mail; creates the account on first use.
 * `captchaToken`: from Turnstile (src/lib/turnstile.ts), checked by Supabase.
 */
export async function sendSignInCode(email: string, captchaToken: string | null = null): Promise<SignInError | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, captchaToken: captchaToken ?? undefined },
  });
  return error ? signInError(error) : null;
}

export async function verifySignInCode(email: string, code: string): Promise<SignInError | null> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  return error ? signInError(error) : null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Deletes the account and all its data on the server (consents, trips, answers,
 * sign-in log), then forgets the session and the trip in progress on this device.
 * Rejects on failure: then nothing was deleted.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  // The user no longer exists: a server sign-out would fail, just clear this device.
  await supabase.auth.signOut({ scope: "local" });
  clearTrip();
}

/** Latest state of each consent of the signed-in user (RLS: only theirs). */
export async function fetchMyConsents(): Promise<ConsentState[]> {
  const { data, error } = await supabase.from("my_consents").select("kind, granted, document_version, created_at");
  if (error) throw error;
  return data.flatMap((row) =>
    row.kind === "terms" || row.kind === "statistics"
      ? [
          {
            kind: row.kind as ConsentKind,
            granted: row.granted === true,
            documentVersion: row.document_version,
            createdAt: row.created_at ?? "",
          },
        ]
      : [],
  );
}

/** First sign-in: accept the terms and choose for statistics, in one insert. */
export async function acceptTerms(contributeToStatistics: boolean): Promise<void> {
  const { error } = await supabase.from("consents").insert(initialConsentRows(contributeToStatistics));
  if (error) throw error;
}

/** Settings: grant or withdraw the statistics consent (a new timestamped row). */
export async function setStatisticsConsent(granted: boolean): Promise<void> {
  const { error } = await supabase.from("consents").insert({ kind: "statistics", granted });
  if (error) throw error;
}
