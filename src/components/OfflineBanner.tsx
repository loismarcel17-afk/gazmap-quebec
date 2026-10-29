"use client";

import { t } from "@/lib/i18n";
import { useOnline } from "@/lib/online";

/** Says why prices and routes don't update, instead of failing silently. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <p role="status" className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-md">
      {t.offline.banner}
    </p>
  );
}
