import type { Metadata } from "next";
import { PlannerView } from "@/components/planner/PlannerView";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: `${t.planner.title} · ${t.app.name}` };

export default function PlanifierPage() {
  return <PlannerView />;
}
