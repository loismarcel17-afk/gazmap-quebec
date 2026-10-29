// Price typed by the user in ¢/L ("185,9", "185.9", "186") ↔ tenths of a cent.
// Same digit-by-digit reading as the Régie adapter: no floating point.

const MIN_TENTHS = 500; // 50 ¢/L
const MAX_TENTHS = 5000; // 500 ¢/L

/** "185,9" → 1859; null if not a plausible price per litre. */
export function parsePriceInput(input: string): number | null {
  const match = input.trim().replace(/\s*¢(\/L)?$/i, "").match(/^(\d{1,3})(?:[.,](\d))?$/);
  if (!match) return null;
  const tenths = Number(match[1]) * 10 + Number(match[2] ?? "0");
  return tenths >= MIN_TENTHS && tenths <= MAX_TENTHS ? tenths : null;
}

/** 1859 → "185,9" (what the input field shows; the unit is beside it). */
export function formatPriceInput(tenths: number): string {
  return `${Math.floor(tenths / 10)},${tenths % 10}`;
}
