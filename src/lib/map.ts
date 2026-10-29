// OpenFreeMap: free vector tiles, no API key. Swap for MapTiler via .env.local.
export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty";

/** Copied by scripts/copy-maplibre-worker.ts */
export const MAPLIBRE_WORKER_PATH = "/maplibre/maplibre-gl-worker.mjs";

/** Southern Québec, where nearly all stations are: [[west, south], [east, north]] */
export const QUEBEC_BOUNDS: [[number, number], [number, number]] = [
  [-79.6, 45.0],
  [-64.2, 49.2],
];

/**
 * Diverging scale: blue (cheaper) ↔ neutral gray (median) ↔ red (pricier).
 * Blue/red instead of green/red because green/red is the pair people with
 * the most common color-vision deficiency can't tell apart.
 */
export const PRICE_COLORS = {
  low: "#256abf",
  median: "#a8a7a0",
  high: "#d03b3b",
} as const;
