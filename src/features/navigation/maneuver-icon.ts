import type { Maneuver } from "@/features/routing/directions";

export type ManeuverIcon =
  | "straight"
  | "slight-left"
  | "left"
  | "sharp-left"
  | "slight-right"
  | "right"
  | "sharp-right"
  | "uturn"
  | "roundabout"
  | "arrive";

const BY_MODIFIER: Record<string, ManeuverIcon> = {
  "slight left": "slight-left",
  left: "left",
  "sharp left": "sharp-left",
  "slight right": "slight-right",
  right: "right",
  "sharp right": "sharp-right",
  uturn: "uturn",
  straight: "straight",
};

/** Mapbox maneuver (type + modifier) → one of the banner's 10 icons. */
export function maneuverIcon(maneuver: Maneuver): ManeuverIcon {
  if (maneuver.type === "arrive") return "arrive";
  if (["roundabout", "rotary", "roundabout turn", "exit roundabout", "exit rotary"].includes(maneuver.type)) {
    return "roundabout";
  }
  return (maneuver.modifier && BY_MODIFIER[maneuver.modifier]) || "straight";
}
