const LOCALE = "fr-CA";
const TIME_ZONE = "America/Toronto"; // Québec's time zone (Eastern Time)

// Intl formatters are costly to create: build once, reuse.
const priceNumber = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

const integer = new Intl.NumberFormat(LOCALE);

/** 1859 (tenths of a cent) → "185,9 ¢/L" (non-breaking space so it never wraps). */
export function formatPrice(tenths: number): string {
  return `${priceNumber.format(tenths / 10)}\u00a0¢/L`;
}

/** "2026-10-28T17:05:00Z" → "28 octobre 2026 à 13 h 05" (Québec time). */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

const kilometersOneDecimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

/** 850 → "850 m", 2430 → "2,4 km", 12_600 → "13 km" (precision drops as distance grows). */
export function formatDistance(meters: number): string {
  // Round first, then pick the unit: 996 m rounds to 1000 → "1 km", not "1000 m".
  const tens = Math.max(10, Math.round(meters / 10) * 10);
  if (tens < 1000) return `${tens}\u00a0m`;
  if (meters < 10_000) return `${kilometersOneDecimal.format(meters / 1000)}\u00a0km`;
  return `${integer.format(Math.round(meters / 1000))}\u00a0km`;
}

const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "CAD" });

/**
 * Amount in tenths of a cent (the app's money unit) → "75,42 $".
 * The only place money gets rounded: to the cent, for display.
 */
export function formatMoney(tenthsOfCent: number): string {
  return money.format(tenthsOfCent / 1000);
}

const clock = new Intl.DateTimeFormat(LOCALE, { timeStyle: "short", timeZone: TIME_ZONE });

/** Trip duration: 45 → "< 1 min", 320 → "5 min", 4 500 → "1 h 15". Rounded up: never promise too short. */
export function formatDuration(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 1) return "<\u00a01\u00a0min";
  if (minutes < 60) return `${minutes}\u00a0min`;
  return `${Math.floor(minutes / 60)}\u00a0h\u00a0${String(minutes % 60).padStart(2, "0")}`;
}

/** Time of day in Québec: "15 h 42". */
export function formatClock(date: Date): string {
  return clock.format(date);
}

/** 2466 → "2 466" */
export function formatInteger(value: number): string {
  return integer.format(value);
}
