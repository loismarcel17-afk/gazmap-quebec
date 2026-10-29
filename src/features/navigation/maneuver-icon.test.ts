import { describe, expect, it } from "vitest";
import { maneuverIcon } from "./maneuver-icon";

describe("maneuverIcon", () => {
  it.each([
    [{ type: "turn", modifier: "left" }, "left"],
    [{ type: "turn", modifier: "sharp right" }, "sharp-right"],
    [{ type: "fork", modifier: "slight left" }, "slight-left"],
    [{ type: "continue", modifier: "uturn" }, "uturn"],
    [{ type: "roundabout", modifier: "right" }, "roundabout"],
    [{ type: "exit rotary", modifier: "left" }, "roundabout"],
    [{ type: "arrive", modifier: "right" }, "arrive"],
    [{ type: "depart", modifier: null }, "straight"],
    [{ type: "new name", modifier: "straight" }, "straight"],
    [{ type: "turn", modifier: "sideways" }, "straight"],
  ] as const)("%o → %s", (maneuver, icon) => {
    expect(maneuverIcon(maneuver)).toBe(icon);
  });
});
