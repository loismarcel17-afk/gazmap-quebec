"use client";

import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState, type ReactNode } from "react";
import { litresToBuy } from "@/features/recommendation/fill-up-cost";
import { TANK_CAPACITY_RANGE, vehicleInput, type ChosenModel } from "@/features/vehicle/profile";
import { formatInteger } from "@/lib/format";
import { interpolate, t } from "@/lib/i18n";
import { useVehicleStore } from "@/lib/vehicle-store";
import { fetchMakes, fetchModelYears, fetchVariants } from "@/lib/vehicles-api";

const LEVELS = [null, 0, 0.25, 0.5, 0.75] as const;
/** Reference data changes a few times a year: never refetch during a visit. */
const REFERENCE = { staleTime: Infinity } as const;

const decimal = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 });

export function variantLabel(variant: ChosenModel): string {
  return interpolate(t.vehicle.variantLabel, {
    engine: decimal.format(variant.engineL),
    transmission: variant.transmission,
    fuel: t.vehicle.fuelCodes[variant.fuelType],
    consumption: decimal.format(variant.combinedLPer100Km),
  });
}

/** Must be rendered after the profile is hydrated: its initial state comes from it. */
export function VehicleForm() {
  const profile = useVehicleStore();
  const saved = profile.model;

  // The year → make → model path being browsed (saved vehicle as starting point).
  const [year, setYear] = useState<number | null>(saved?.modelYear ?? null);
  const [make, setMake] = useState<string | null>(saved?.make ?? null);
  const [modelName, setModelName] = useState<string | null>(saved?.model ?? null);
  const [tankText, setTankText] = useState(profile.tankCapacityL?.toString() ?? "");

  const years = useQuery({ queryKey: ["vehicle-years"], queryFn: fetchModelYears, ...REFERENCE });
  const makes = useQuery({
    queryKey: ["vehicle-makes", year],
    queryFn: () => fetchMakes(year!),
    enabled: year !== null, // don't run until a year is chosen
    ...REFERENCE,
  });
  const variants = useQuery({
    queryKey: ["vehicle-variants", year, make],
    queryFn: () => fetchVariants(year!, make!),
    enabled: year !== null && make !== null,
    ...REFERENCE,
  });

  const models = useMemo(() => [...new Set(variants.data?.map((v) => v.model))], [variants.data]);
  const modelVariants = useMemo(
    () => variants.data?.filter((v) => v.model === modelName) ?? [],
    [variants.data, modelName],
  );

  // Changing an earlier choice invalidates the later ones, and the saved vehicle.
  function chooseYear(value: number | null) {
    setYear(value);
    setMake(null);
    setModelName(null);
    profile.setModel(null);
  }
  function chooseMake(value: string | null) {
    setMake(value);
    setModelName(null);
    profile.setModel(null);
  }
  function chooseModel(value: string | null) {
    setModelName(value);
    const options = variants.data?.filter((v) => v.model === value) ?? [];
    // A single version: pick it, no need to ask.
    profile.setModel(options.length === 1 ? options[0] : null);
  }

  const tankError = tankText !== "" && profile.tankCapacityL === null;
  function changeTank(text: string) {
    setTankText(text);
    const litres = Number(text.replace(",", "."));
    const valid = text.trim() !== "" && litres >= TANK_CAPACITY_RANGE.min && litres <= TANK_CAPACITY_RANGE.max;
    profile.setTankCapacity(valid ? litres : null);
  }

  function removeVehicle() {
    profile.reset();
    setYear(null);
    setMake(null);
    setModelName(null);
    setTankText("");
  }

  const ids = { tank: useId(), tankHelp: useId() };
  const failed = years.isError || makes.isError || variants.isError;

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold text-zinc-950">{t.vehicle.chooseModel}</legend>

        <Select
          label={t.vehicle.year}
          value={year?.toString() ?? ""}
          onChange={(value) => chooseYear(value ? Number(value) : null)}
          disabled={!years.data}
          loading={years.isFetching}
        >
          {years.data?.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>

        <Select
          label={t.vehicle.make}
          value={make ?? ""}
          onChange={(value) => chooseMake(value || null)}
          disabled={!makes.data}
          loading={makes.isFetching}
        >
          {makes.data?.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>

        <Select
          label={t.vehicle.model}
          value={modelName ?? ""}
          onChange={(value) => chooseModel(value || null)}
          disabled={!variants.data}
          loading={variants.isFetching}
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>

        {modelVariants.length > 1 && (
          <Select
            label={t.vehicle.variant}
            value={saved && saved.model === modelName ? saved.id.toString() : ""}
            onChange={(value) => profile.setModel(modelVariants.find((v) => v.id === Number(value)) ?? null)}
          >
            {modelVariants.map((v) => (
              <option key={v.id} value={v.id}>
                {variantLabel(v)}
              </option>
            ))}
          </Select>
        )}

        {failed && (
          <p role="alert" className="text-sm text-red-800">
            {t.vehicle.loadError}
          </p>
        )}

        {saved && (
          <div className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-800" aria-live="polite">
            <p className="font-semibold text-zinc-950">
              {saved.make} {saved.model} {saved.modelYear}
            </p>
            <p>{interpolate(t.vehicle.summary, { consumption: decimal.format(saved.combinedLPer100Km) })}</p>
            <p>{interpolate(t.vehicle.recommendedFuel, { fuel: t.vehicle.fuelCodes[saved.fuelType] })}</p>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor={ids.tank} className="font-semibold text-zinc-950">
          {t.vehicle.tank}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={ids.tank}
            type="number"
            inputMode="decimal"
            min={TANK_CAPACITY_RANGE.min}
            max={TANK_CAPACITY_RANGE.max}
            step={1}
            value={tankText}
            onChange={(event) => changeTank(event.target.value)}
            aria-invalid={tankError}
            aria-describedby={ids.tankHelp}
            className="min-h-11 w-28 rounded-lg border border-zinc-300 px-3 text-base text-zinc-950 aria-invalid:border-red-700 focus-visible:outline-2 focus-visible:outline-blue-700"
          />
          <span className="text-zinc-700">{t.vehicle.tankUnit}</span>
        </div>
        <p id={ids.tankHelp} className={`text-sm ${tankError ? "text-red-800" : "text-zinc-600"}`}>
          {tankError
            ? interpolate(t.vehicle.tankInvalid, TANK_CAPACITY_RANGE)
            : t.vehicle.tankHint}
        </p>
      </div>

      <div role="group" aria-labelledby="level-label" className="flex flex-col gap-2">
        <span id="level-label" className="font-semibold text-zinc-950">
          {t.vehicle.level}
        </span>
        <div className="flex flex-wrap gap-1">
          {LEVELS.map((level) => (
            <button
              key={String(level)}
              type="button"
              aria-pressed={profile.currentLevel === level}
              onClick={() => profile.setCurrentLevel(level)}
              className="min-h-11 rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-700 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 aria-pressed:bg-zinc-900 aria-pressed:text-white"
            >
              {level === null ? t.vehicle.levelUnknown : t.vehicle.levels[String(level) as keyof typeof t.vehicle.levels]}
            </button>
          ))}
        </div>
      </div>

      <p className="rounded-xl bg-blue-50 p-3 font-medium text-blue-900" aria-live="polite">
        {interpolate(t.vehicle.estimate, {
          litres: formatInteger(Math.round(litresToBuy(vehicleInput(profile)))),
        })}
      </p>

      {(saved || profile.tankCapacityL !== null || profile.currentLevel !== null) && (
        <button
          type="button"
          onClick={removeVehicle}
          className="min-h-11 self-start rounded-full px-4 font-medium text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          {t.vehicle.remove}
        </button>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  disabled,
  loading,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Options are being downloaded (vs. waiting for an earlier choice) */
  loading?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-950 disabled:bg-zinc-100 disabled:text-zinc-500 focus-visible:outline-2 focus-visible:outline-blue-700"
      >
        <option value="">{loading ? t.vehicle.loading : t.vehicle.choose}</option>
        {children}
      </select>
    </div>
  );
}
