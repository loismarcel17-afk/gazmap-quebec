import type { Metadata } from "next";
import { DestinationScreen } from "@/components/navigation/DestinationScreen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: `${t.planner.title} · ${t.app.name}` };

export default function DestinationPage() {
  return <DestinationScreen />;
}
