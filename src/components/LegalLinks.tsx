import Link from "next/link";
import { t } from "@/lib/i18n";

/**
 * Privacy policy and terms. Not prefetched: rarely opened, and on the home page
 * the prefetch would compete with the station list for a phone's bandwidth.
 */
export function LegalLinks({ className = "" }: { className?: string }) {
  const link =
    "inline-flex min-h-11 items-center rounded font-medium text-blue-800 underline focus-visible:outline-2 focus-visible:outline-blue-700";
  return (
    <nav aria-label={t.legalLinks.label} className={`flex flex-wrap gap-x-4 ${className}`}>
      <Link href="/legal/confidentialite" prefetch={false} className={link}>
        {t.legalLinks.privacy}
      </Link>
      <Link href="/legal/conditions" prefetch={false} className={link}>
        {t.legalLinks.terms}
      </Link>
    </nav>
  );
}
