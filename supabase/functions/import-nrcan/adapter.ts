// Adapter: NRCan "Fuel consumption ratings" (open.canada.ca) → vehicle models.
//
// The ONLY file that knows NRCan's file names, columns and value formats.
// Pure TypeScript with no imports: runs in Node (tests) and Deno (Edge Function).
// Source licence: Open Government Licence – Canada (attribution required).

/** NRCan fuel codes: X regular, Z premium, D diesel, E E85, N natural gas. */
export type NrcanFuelType = "X" | "Z" | "D";

export interface VehicleModel {
  modelYear: number;
  make: string;
  model: string;
  vehicleClass: string;
  engineL: number;
  cylinders: number;
  transmission: string;
  fuelType: NrcanFuelType;
  cityLPer100Km: number;
  highwayLPer100Km: number;
  combinedLPer100Km: number;
}

export interface NrcanParseResult {
  models: VehicleModel[];
  /** Rows skipped on purpose (E85, natural gas) are not issues; unreadable rows are. */
  issues: string[];
}

// ---------------------------------------------------------------------------
// Which files to download

/** French yearly gasoline/diesel ratings, e.g. am2026-cotes-de-consommation-de-carburant.csv
 *  (excludes electric, plug-in hybrid and the pre-2015 "cinq-cycles" files). */
const RATINGS_FILE_RE = /\/am(\d{4})(?:-(\d{4}))?-cotes-de-consommation-de-carburant\.csv$/;

/** From the open.canada.ca catalog entry (CKAN package_show), the CSV URLs to import.
 *  Discovered rather than hard-coded, so next year's file is picked up automatically. */
export function selectRatingFiles(ckanPackage: unknown): string[] {
  if (!isObject(ckanPackage) || !Array.isArray(ckanPackage.resources)) {
    throw new Error("NRCan catalog: no resources");
  }
  return ckanPackage.resources
    .filter(isObject)
    .map((resource) => String(resource.url ?? ""))
    .filter((url) => RATINGS_FILE_RE.test(url))
    // Sort by file name (oldest years first), not by full URL: the URL starts
    // with a random resource id that would decide the order otherwise.
    .sort((a, b) => fileName(a).localeCompare(fileName(b)));
}

function fileName(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1);
}

// ---------------------------------------------------------------------------
// Decoding and parsing

/**
 * NRCan publishes in Windows-1252 (old Western European encoding), not UTF-8:
 * read as UTF-8, "Année" turns into "Ann�e". Try strict UTF-8 first in case
 * they switch one day; fall back to Windows-1252.
 */
export function decodeNrcanCsv(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, ""); // byte order mark, if any
}

const COLUMNS = {
  modelYear: "Année modèle",
  make: "Marque",
  model: "Modèle",
  vehicleClass: "Catégorie de véhicule",
  engineL: "Cylindrée (L)",
  cylinders: "Cylindres",
  transmission: "Transmission",
  fuelType: "Type de carburant",
  city: "Ville (L/100 km)",
  highway: "Route (L/100 km)",
  combined: "Combinée (L/100 km)",
} as const;

type ColumnKey = keyof typeof COLUMNS;

// E85 and natural gas: the Régie publishes no price for them, and every E85
// vehicle also has a gasoline row (it can run on regular).
const SKIPPED_FUELS = new Set(["E", "N"]);
const KEPT_FUELS = new Set<string>(["X", "Z", "D"]);

export function parseNrcanCsv(text: string): NrcanParseResult {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new Error("NRCan CSV is empty");
  const columns = locateColumns(header);

  const models: VehicleModel[] = [];
  const issues: string[] = [];

  body.forEach((row, index) => {
    const where = `line ${index + 2}`;
    if (row.every((value) => value.trim() === "")) return;
    const cell = (key: ColumnKey) => (row[columns[key]] ?? "").trim();

    const fuel = cell("fuelType");
    if (SKIPPED_FUELS.has(fuel)) return;
    if (!KEPT_FUELS.has(fuel)) {
      issues.push(`${where}: unknown fuel type "${fuel}"`);
      return;
    }

    const modelYear = Number(cell("modelYear"));
    const engineL = Number(cell("engineL"));
    const cylinders = Number(cell("cylinders"));
    const city = Number(cell("city"));
    const highway = Number(cell("highway"));
    const combined = Number(cell("combined"));
    const consumptions = [city, highway, combined];

    if (!Number.isInteger(modelYear) || modelYear < 1990 || modelYear > 2100) {
      issues.push(`${where}: invalid model year "${cell("modelYear")}"`);
      return;
    }
    if (consumptions.some((value) => !Number.isFinite(value) || value <= 0 || value > 50)) {
      issues.push(`${where}: invalid consumption (${cell("city")}, ${cell("highway")}, ${cell("combined")})`);
      return;
    }
    if (!cell("make") || !cell("model")) {
      issues.push(`${where}: missing make or model`);
      return;
    }

    models.push({
      modelYear,
      make: cell("make"),
      model: cell("model"),
      vehicleClass: cell("vehicleClass"),
      engineL: Number.isFinite(engineL) ? engineL : 0,
      cylinders: Number.isInteger(cylinders) ? cylinders : 0,
      transmission: cell("transmission"),
      fuelType: fuel as NrcanFuelType,
      cityLPer100Km: city,
      highwayLPer100Km: highway,
      combinedLPer100Km: combined,
    });
  });

  return { models, issues };
}

/** Minimal RFC 4180 CSV parser: commas, "quoted, fields", "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function locateColumns(header: string[]): Record<ColumnKey, number> {
  const normalized = header.map((title) => title.trim().toLowerCase());
  const entries = (Object.keys(COLUMNS) as ColumnKey[]).map((key) => {
    const index = normalized.indexOf(COLUMNS[key].toLowerCase());
    if (index === -1) throw new Error(`NRCan CSV: column "${COLUMNS[key]}" not found`);
    return [key, index] as const;
  });
  return Object.fromEntries(entries) as Record<ColumnKey, number>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
