import { FUEL_TYPES, type FuelType } from "@/features/stations/types";
import { t } from "@/lib/i18n";

interface FuelSelectorProps {
  value: FuelType;
  onChange: (fuel: FuelType) => void;
}

export function FuelSelector({ value, onChange }: FuelSelectorProps) {
  return (
    <div role="group" aria-label={t.fuel.label} className="flex rounded-full bg-zinc-100 p-1">
      {FUEL_TYPES.map((fuel) => (
        <button
          key={fuel}
          type="button"
          // aria-pressed tells screen readers which option is on.
          aria-pressed={fuel === value}
          onClick={() => onChange(fuel)}
          className="min-h-11 flex-1 rounded-full px-4 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 aria-pressed:bg-white aria-pressed:text-zinc-950 aria-pressed:shadow-sm"
        >
          {t.fuel[fuel]}
        </button>
      ))}
    </div>
  );
}
