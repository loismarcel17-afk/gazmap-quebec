import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackCard } from "@/components/FeedbackCard";
import { fuelFromParam } from "@/features/stations/fuel-param";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: `${t.feedback.arrived} · ${t.app.name}` };

interface PageProps {
  params: Promise<{ id: string }>;
  /** ?trajet=<trip id>&carburant=ordinaire|super|diesel */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default function RetourPage(props: PageProps) {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <Feedback {...props} />
    </Suspense>
  );
}

async function Feedback({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const trip = typeof query.trajet === "string" && /^[0-9a-f-]{36}$/.test(query.trajet) ? query.trajet : null;
  return <FeedbackCard stationId={id} tripId={trip} initialFuel={fuelFromParam(query.carburant)} />;
}
