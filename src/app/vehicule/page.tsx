import type { Metadata } from "next";
import { VehiclePage } from "@/components/VehiclePage";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: `${t.vehicle.title} · ${t.app.name}`,
};

export default function VehiculePage() {
  return <VehiclePage />;
}
