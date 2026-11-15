import { describe, expect, it } from "vitest";
import type { Position } from "@/features/navigation/geometry";
import { simplifyLine } from "./simplify";

// ~111 m per 0.001° of latitude.
describe("simplifyLine", () => {
  it("drops points on a straight line, keeps both ends", () => {
    const line: Position[] = Array.from({ length: 101 }, (_, i) => [-72, 45 + i * 0.001]);
    expect(simplifyLine(line)).toEqual([line[0], line[100]]);
  });

  it("keeps a corner farther than the tolerance, drops wiggles under it", () => {
    const line: Position[] = [
      [-72, 45],
      [-72.00001, 45.005], // ~1 m off the chord: dropped
      [-72, 45.01], // the corner: kept
      [-71.99, 45.01],
    ];
    expect(simplifyLine(line)).toEqual([line[0], line[2], line[3]]);
  });

  it("handles thousands of points without recursion", () => {
    const line: Position[] = Array.from({ length: 20_000 }, (_, i) => [-72 + i * 0.0001, 45 + Math.sin(i / 50) * 0.01]);
    const simplified = simplifyLine(line);
    expect(simplified.length).toBeLessThan(line.length / 10);
    expect(simplified[0]).toEqual(line[0]);
    expect(simplified.at(-1)).toEqual(line.at(-1));
  });

  it("returns short lines unchanged", () => {
    const line: Position[] = [
      [-72, 45],
      [-71, 46],
    ];
    expect(simplifyLine(line)).toBe(line);
  });
});
