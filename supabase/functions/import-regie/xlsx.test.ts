import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseRegieRows } from "./adapter.ts";
import { columnIndex, readXlsxRows } from "./xlsx.ts";

const NS = 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

function buildXlsx(sheetData: string, sharedStrings: string[]): Uint8Array {
  const sst = sharedStrings.map((text) => `<x:si><x:t>${text}</x:t></x:si>`).join("");
  return zipSync({
    "xl/sharedStrings.xml": strToU8(`<?xml version="1.0"?><x:sst ${NS}>${sst}</x:sst>`),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0"?><x:worksheet ${NS}><x:cols><x:col min="1" max="1"/></x:cols>` +
        `<x:sheetData>${sheetData}</x:sheetData></x:worksheet>`,
    ),
  });
}

describe("columnIndex", () => {
  it.each([
    ["A1", 0],
    ["J12", 9],
    ["Z3", 25],
    ["AA3", 26],
  ])("%s → %i", (ref, expected) => {
    expect(columnIndex(ref)).toBe(expected);
  });
});

describe("readXlsxRows", () => {
  it("reads prefixed XML, shared strings, numbers and gaps", () => {
    const file = buildXlsx(
      '<x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>1</x:v></x:c></x:row>' +
        '<x:row r="2"><x:c r="A2"><x:v>48.25</x:v></x:c><x:c r="C2" t="s"><x:v>2</x:v></x:c></x:row>' +
        '<x:row r="3"/>',
      ["Nom", "Bannière", "Tim &amp; Co"],
    );

    expect(readXlsxRows(file)).toEqual([["Nom", "Bannière"], ["48.25", "", "Tim & Co"], []]);
  });

  it("rejects a file without a worksheet", () => {
    expect(() => readXlsxRows(zipSync({ "hello.txt": strToU8("hi") }))).toThrow(/sheet1/);
  });
});

describe("Régie fixture (real export)", () => {
  const dir = fileURLToPath(new URL("../../fixtures/regie", import.meta.url));
  const fixture = readdirSync(dir).find((file) => file.endsWith(".xlsx"));

  it("parses end to end", () => {
    expect(fixture).toBeDefined();
    const rows = readXlsxRows(new Uint8Array(readFileSync(join(dir, fixture!))));
    const { stations } = parseRegieRows(rows);

    expect(rows[0]).toContain("Prix Régulier");
    expect(stations.length).toBeGreaterThan(2000);
    expect(new Set(stations.map((s) => s.id)).size).toBe(stations.length);
    expect(stations.every((s) => s.prices.regular === null || Number.isInteger(s.prices.regular))).toBe(
      true,
    );
  });
});
