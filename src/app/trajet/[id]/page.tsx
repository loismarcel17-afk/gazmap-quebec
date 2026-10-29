import type { Metadata } from "next";
import { Suspense } from "react";
import { TripScreen } from "@/components/navigation/TripScreen";
import { fuelFromParam } from "@/features/stations/fuel-param";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: `${t.navigation.safety.title} · ${t.app.name}` };

interface PageProps {
  params: Promise<{ id: string }>;
  /** ?carburant=ordinaire|super|diesel */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// With Cache Components, reading params / searchParams must happen inside
// <Suspense>: the rest of the page is prerendered, this part streams at request time.
export default function TrajetPage(props: PageProps) {
  return (
    <Suspense fallback={<main className="h-dvh bg-zinc-200" />}>
      <Trip {...props} />
    </Suspense>
  );
}

async function Trip({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <TripScreen stationId={id} fuel={fuelFromParam(query.carburant)} />;
}
