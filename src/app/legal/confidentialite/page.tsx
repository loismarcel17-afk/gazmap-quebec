import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { TERMS_VERSION } from "@/features/account/consents";
import { interpolate, t } from "@/lib/i18n";

export const metadata: Metadata = { title: `${t.legal.privacy.title} · ${t.app.name}` };

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title={t.legal.privacy.title}
      version={interpolate(t.legal.version, { version: TERMS_VERSION })}
      sections={t.legal.privacy.sections}
    />
  );
}
