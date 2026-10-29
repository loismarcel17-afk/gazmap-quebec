import type { ExpressionSpecification } from "maplibre-gl";
import type { LayerProps } from "react-map-gl/maplibre";
import type { PriceScale } from "@/features/stations/price-scale";
import { PRICE_COLORS } from "@/lib/map";

export const SOURCE_ID = "stations";
export const STATIONS_LAYER_ID = "stations";
/** Invisible, larger circles: easier to tap than the visible 9 px dots. */
export const HIT_LAYER_ID = "stations-hit";

/**
 * MapLibre "expression" (a tiny language evaluated on the GPU, per feature):
 * color each dot by interpolating its price between the scale's three stops.
 */
export function priceColor(scale: PriceScale): ExpressionSpecification | string {
  const { low, high } = scale;
  // Interpolation stops must be strictly increasing.
  if (high <= low) return PRICE_COLORS.median;
  const median = scale.median > low && scale.median < high ? scale.median : (low + high) / 2;

  return [
    "interpolate",
    ["linear"],
    ["get", "price"],
    low,
    PRICE_COLORS.low,
    median,
    PRICE_COLORS.median,
    high,
    PRICE_COLORS.high,
  ];
}

// Dots grow with zoom: small when 2 466 stations share the screen, larger up close.
const radius: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 5, 4.5, 10, 7, 14, 10];

export function stationsLayer(scale: PriceScale): LayerProps {
  return {
    id: STATIONS_LAYER_ID,
    type: "circle",
    // Higher sort key is drawn on top: the cheapest stations stay visible where dots overlap.
    layout: { "circle-sort-key": ["-", 0, ["get", "price"]] },
    paint: {
      "circle-color": priceColor(scale),
      "circle-radius": radius,
      // White ring separates overlapping dots and lifts them off the basemap.
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 10, 2],
    },
  };
}

export const hitLayer: LayerProps = {
  id: HIT_LAYER_ID,
  type: "circle",
  paint: { "circle-radius": 16, "circle-opacity": 0 },
};

export const radiusFillLayer: LayerProps = {
  id: "search-radius-fill",
  type: "fill",
  paint: { "fill-color": "#0b0b0b", "fill-opacity": 0.04 },
};

export const radiusLineLayer: LayerProps = {
  id: "search-radius-line",
  type: "line",
  paint: { "line-color": "#0b0b0b", "line-opacity": 0.55, "line-width": 1.5, "line-dasharray": [2, 2] },
};

export function selectedLayer(selectedId: string | null): LayerProps {
  return {
    id: "station-selected",
    type: "circle",
    filter: ["==", ["get", "id"], selectedId ?? ""],
    paint: {
      "circle-color": "rgba(0, 0, 0, 0)",
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 9, 10, 12, 14, 15],
      "circle-stroke-color": "#0b0b0b",
      "circle-stroke-width": 3,
    },
  };
}
