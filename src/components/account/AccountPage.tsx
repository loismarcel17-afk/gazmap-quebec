"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { summarizeConsents } from "@/features/account/consents";
import { acceptTerms, deleteMyAccount, fetchMyConsents, setStatisticsConsent, signOut } from "@/lib/account-api";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { clearMyTrips, fetchMyTrips } from "@/lib/trips-api";
import { LegalLinks } from "../LegalLinks";
import { AccountSettings, DeleteAccount } from "./AccountSettings";
import { ConsentForm } from "./ConsentForm";
import { SignInForm } from "./SignInForm";
import { TripHistory } from "./TripHistory";

/** /compte: sign in → accept the terms (first time) → settings. */
export function AccountPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.status === "signedIn" ? session.userId : null;
  // Shown once the account is gone (the page then falls back to the sign-in form).
  const [deleted, setDeleted] = useState(false);

  async function deleteAccount() {
    await deleteMyAccount();
    queryClient.clear(); // nothing of the deleted account stays in memory
    setDeleted(true);
  }

  const consents = useQuery({
    queryKey: ["consents", userId],
    queryFn: fetchMyConsents,
    enabled: userId !== null,
  });
  const refreshConsents = () => queryClient.invalidateQueries({ queryKey: ["consents", userId] });
  const termsAccepted = consents.data ? summarizeConsents(consents.data).termsAccepted : false;
  const trips = useQuery({
    queryKey: ["trips", userId],
    queryFn: () => fetchMyTrips(),
    enabled: userId !== null && termsAccepted,
  });

  let content;
  if (session.status === "loading" || (userId && consents.isPending)) {
    content = <p className="text-zinc-700">{t.account.loading}</p>;
  } else if (session.status === "signedOut") {
    content = (
      <>
        {deleted && (
          <p role="status" className="rounded-xl bg-green-50 p-3 font-medium text-green-900">
            {t.account.settings.deleted}
          </p>
        )}
        <p className="text-zinc-700">{t.account.why}</p>
        <SignInForm />
      </>
    );
  } else if (consents.isError) {
    content = (
      <p role="alert" className="text-red-800">
        {t.account.signIn.errors.unavailable}
      </p>
    );
  } else {
    const summary = summarizeConsents(consents.data ?? []);
    content = summary.termsAccepted ? (
      <>
        <AccountSettings
          email={session.status === "signedIn" ? session.email : ""}
          consents={summary}
          onStatisticsChange={async (granted) => {
            await setStatisticsConsent(granted);
            await refreshConsents();
          }}
          onSignOut={() => void signOut()}
        />
        <TripHistory
          trips={trips.data}
          failed={trips.isError}
          onClear={async () => {
            await clearMyTrips();
            await queryClient.invalidateQueries({ queryKey: ["trips", userId] });
          }}
        />
        <DeleteAccount onDelete={deleteAccount} />
      </>
    ) : (
      <ConsentForm
        onAccept={async (statistics) => {
          await acceptTerms(statistics);
          await refreshConsents();
        }}
        // A brand-new account without the terms has no use: erase it, e-mail
        // included. An existing user shown NEW terms keeps their data: sign out.
        onDecline={summary.termsEverAccepted ? signOut : deleteAccount}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 p-4 pb-10">
      <Link
        href="/"
        className="flex min-h-11 items-center gap-1 self-start rounded-full pr-3 font-medium text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t.account.backToMap}
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-950">{t.account.title}</h1>
      {content}
      <LegalLinks className="mt-auto border-t border-zinc-200 pt-4 text-sm" />
    </main>
  );
}
