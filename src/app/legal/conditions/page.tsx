import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { TERMS_VERSION } from "@/features/account/consents";
import { interpolate, t } from "@/lib/i18n";

export const metadata: Metadata = { title: `${t.legal.terms.title} · ${t.app.name}` };

export default function ConditionsPage() {
  return (
    <LegalPage
      title={t.legal.terms.title}
      version={interpolate(t.legal.version, { version: TERMS_VERSION })}
      sections={t.legal.terms.sections}
    />
  );
}
