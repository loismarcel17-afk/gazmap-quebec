import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeNrcanCsv, parseCsv, parseNrcanCsv, selectRatingFiles } from "./adapter.ts";

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../fixtures/rncan/${name}`, import.meta.url)));

const HEADER =
  "Année modèle,Marque,Modèle,Catégorie de véhicule,Cylindrée (L),Cylindres,Transmission,Type de carburant," +
  "Ville (L/100 km),Route (L/100 km),Combinée (L/100 km),Combinée (mi/gal),Émissions de CO2 (g/km),Indice de CO2,Indice de smog";

describe("decodeNrcanCsv", () => {
  it("reads Windows-1252 accents correctly", () => {
    // "Année" in Windows-1252: é is the single byte 0xE9 (invalid on its own in UTF-8)
    expect(decodeNrcanCsv(new Uint8Array([0x41, 0x6e, 0x6e, 0xe9, 0x65]))).toBe("Année");
  });

  it("still reads UTF-8, and drops a byte order mark", () => {
    expect(decodeNrcanCsv(new TextEncoder().encode("﻿Année"))).toBe("Année");
  });
});

describe("parseCsv", () => {
  it("handles CRLF, quotes, escaped quotes and commas inside quotes", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });

  it("keeps empty fields and a last line without newline", () => {
    expect(parseCsv("a,,c\n1,2,3")).toEqual([
      ["a", "", "c"],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseNrcanCsv", () => {
  it("maps a row to a vehicle model", () => {
    const { models, issues } = parseNrcanCsv(
      `${HEADER}\r\n2026,Honda,Civic Sedan,Compacte,2.0,4,AV7,X,7.4,5.8,6.7,42,157,7,7\r\n`,
    );
    expect(issues).toEqual([]);
    expect(models).toEqual([
      {
        modelYear: 2026,
        make: "Honda",
        model: "Civic Sedan",
        vehicleClass: "Compacte",
        engineL: 2,
        cylinders: 4,
        transmission: "AV7",
        fuelType: "X",
        cityLPer100Km: 7.4,
        highwayLPer100Km: 5.8,
        combinedLPer100Km: 6.7,
      },
    ]);
  });

  it("skips E85 and natural gas rows silently (no price for them)", () => {
    const { models, issues } = parseNrcanCsv(
      `${HEADER}\n2015,Ford,F-150,Camionnette,3.5,6,AS6,E,18.0,13.0,15.7,18,0,s.o.,s.o.\n` +
        `2015,Chevrolet,Impala Dual Fuel,Grande,3.6,6,AS6,N,17.4,11.6,14.8,19,0,s.o.,s.o.\n`,
    );
    expect(models).toEqual([]);
    expect(issues).toEqual([]);
  });

  it("reports bad rows instead of guessing", () => {
    const { models, issues } = parseNrcanCsv(
      `${HEADER}\n2026,Honda,Civic,Compacte,2.0,4,AV7,Q,7.4,5.8,6.7,42,157,7,7\n` +
        `2026,Honda,Civic,Compacte,2.0,4,AV7,X,7.4,5.8,s.o.,42,157,7,7\n` +
        `20X6,Honda,Civic,Compacte,2.0,4,AV7,X,7.4,5.8,6.7,42,157,7,7\n`,
    );
    expect(models).toEqual([]);
    expect(issues).toEqual([
      'line 2: unknown fuel type "Q"',
      "line 3: invalid consumption (7.4, 5.8, s.o.)",
      'line 4: invalid model year "20X6"',
    ]);
  });

  it("throws when a column is missing", () => {
    expect(() => parseNrcanCsv("Année modèle,Marque\n2026,Honda\n")).toThrow(/Modèle/);
  });
});

describe("selectRatingFiles", () => {
  it("picks the yearly French gasoline files from the real catalog, nothing else", () => {
    const urls = selectRatingFiles(JSON.parse(fixture("ckan-package.json").toString("utf8")).result);
    expect(urls.map((url) => url.split("/").pop())).toEqual([
      "am2015-2024-cotes-de-consommation-de-carburant.csv",
      "am2025-cotes-de-consommation-de-carburant.csv",
      "am2026-cotes-de-consommation-de-carburant.csv",
    ]);
  });
});

describe("NRCan fixtures (real files)", () => {
  it("parse end to end with correct accents", () => {
    const all = [
      "am2015-2024-cotes-de-consommation-de-carburant.csv",
      "am2025-cotes-de-consommation-de-carburant.csv",
      "am2026-cotes-de-consommation-de-carburant.csv",
    ].map((name) => parseNrcanCsv(decodeNrcanCsv(new Uint8Array(fixture(name)))));

    const models = all.flatMap((result) => result.models);
    expect(all.flatMap((result) => result.issues)).toEqual([]);
    expect(models).toHaveLength(11_374 - 334 - 1); // minus E85 and natural gas rows
    expect(models.some((m) => m.vehicleClass.startsWith("Véhicule utilitaire sport"))).toBe(true);
    expect(models.every((m) => !m.vehicleClass.includes("�"))).toBe(true); // no "�"
  });
});
