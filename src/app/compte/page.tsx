import type { Metadata } from "next";
import { AccountPage } from "@/components/account/AccountPage";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: `${t.account.title} · ${t.app.name}` };

export default function ComptePage() {
  return <AccountPage />;
}
