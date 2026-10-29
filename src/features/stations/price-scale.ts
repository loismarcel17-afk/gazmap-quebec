import type { FuelType, Station } from "./types";

/**
 * Price reference points used to color stations: low (10th percentile),
 * median, high (90th percentile). Percentiles instead of min/max so a single
 * outlier at 250 ¢/L doesn't wash every other station into the same color.
 */
export interface PriceScale {
  low: number;
  median: number;
  high: number;
}

export function computePriceScale(stations: Station[], fuel: FuelType): PriceScale | null {
  const prices = stations
    .map((station) => station.prices[fuel])
    .filter((price): price is number => price !== null)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;

  return {
    low: percentile(prices, 0.1),
    median: percentile(prices, 0.5),
    high: percentile(prices, 0.9),
  };
}

/** Nearest-rank percentile of an ascending array. */
function percentile(sorted: number[], p: number): number {
  const rank = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
}
