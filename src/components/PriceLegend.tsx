import type { PriceScale } from "@/features/stations/price-scale";
import { formatDateTime, formatInteger, formatPrice } from "@/lib/format";
import { interpolate, plural, t } from "@/lib/i18n";
import { PRICE_COLORS } from "@/lib/map";
import { LegalLinks } from "./LegalLinks";

interface PriceLegendProps {
  scale: PriceScale;
  stationCount: number;
  updatedAt: string;
}

export function PriceLegend({ scale, stationCount, updatedAt }: PriceLegendProps) {
  return (
    <div className="rounded-xl bg-white/95 p-3 text-xs text-zinc-700 shadow-md backdrop-blur">
      <p className="font-medium text-zinc-900">{t.legend.title}</p>
      <div
        aria-hidden
        className="mt-2 h-2 rounded-full"
        style={{
          background: `linear-gradient(to right, ${PRICE_COLORS.low}, ${PRICE_COLORS.median}, ${PRICE_COLORS.high})`,
        }}
      />
      {/* Words + prices carry the meaning, so the legend works without seeing color. */}
      <div className="mt-1 flex justify-between gap-4">
        <span>
          {t.legend.cheaper} · {formatPrice(scale.low)}
        </span>
        <span>
          {t.legend.pricier} · {formatPrice(scale.high)}
        </span>
      </div>
      <p className="mt-2 text-zinc-600">
        {plural(t.map.stationCount, stationCount, { count: formatInteger(stationCount) })}
        <br />
        {t.map.source} · {interpolate(t.map.updatedAt, { date: formatDateTime(updatedAt) })}
      </p>
      <LegalLinks className="-mb-2" />
    </div>
  );
}
