import type { Metadata } from "next";
import { RetryButton } from "@/components/RetryButton";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: `${t.offline.title} · ${t.app.name}` };

/**
 * Kept on the phone at install (precache) and shown by the service worker when
 * a page is opened without a connection and no copy of it is kept.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 p-6">
      <svg aria-hidden viewBox="0 0 24 24" className="size-12 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" strokeLinecap="round" />
      </svg>
      <h1 className="text-3xl font-bold text-zinc-950">{t.offline.title}</h1>
      <p className="text-lg text-zinc-700">{t.offline.text}</p>
      <RetryButton />
    </main>
  );
}
