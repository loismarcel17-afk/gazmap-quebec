"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/** Link to /compte: "Mon compte" when signed in, "Se connecter" otherwise. */
export function AccountChip() {
  const session = useSession();
  if (session.status === "loading") return null;
  return (
    <Link
      href="/compte"
      className="flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-zinc-800 shadow-md hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-blue-700"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
      </svg>
      {session.status === "signedIn" ? t.account.chip : t.account.chipSignedOut}
    </Link>
  );
}
