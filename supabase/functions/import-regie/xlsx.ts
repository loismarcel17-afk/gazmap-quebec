// Minimal .xlsx reader: returns the first worksheet as rows of strings.
//
// An .xlsx file is a zip archive of XML files. Off-the-shelf readers choke on the
// Régie export because its XML uses a namespace prefix (<x:row>, <x:c>…), so we
// unzip with fflate and read the few tags we need with prefix-agnostic regexes.
// Only uses fflate so it also runs in Deno (Supabase Edge Functions).
import { strFromU8, unzipSync } from "fflate";

const SHEET_PATH = "xl/worksheets/sheet1.xml";
const SHARED_STRINGS_PATH = "xl/sharedStrings.xml";

// `(?:\w+:)?` accepts an optional namespace prefix: <row>, <x:row>, <ns0:row>…
// Each element regex also matches the self-closing form (<x:c r="B2"/>).
const SHARED_STRING_RE = /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g;
const TEXT_RE = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g;
const ROW_RE = /<(?:\w+:)?row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g;
const CELL_RE = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
const VALUE_RE = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/;

export function readXlsxRows(data: Uint8Array): string[][] {
  const files = unzipSync(data, {
    filter: (file) => file.name === SHEET_PATH || file.name === SHARED_STRINGS_PATH,
  });
  const sheet = files[SHEET_PATH];
  if (!sheet) throw new Error(`Invalid .xlsx: ${SHEET_PATH} not found`);

  const sharedStrings = files[SHARED_STRINGS_PATH]
    ? parseSharedStrings(strFromU8(files[SHARED_STRINGS_PATH]))
    : [];

  const rows: string[][] = [];
  for (const rowMatch of strFromU8(sheet).matchAll(ROW_RE)) {
    const row: string[] = [];
    for (const cellMatch of (rowMatch[1] ?? "").matchAll(CELL_RE)) {
      const attributes = cellMatch[1];
      const ref = attribute(attributes, "r");
      // Empty cells are often omitted, so place each value by its column letter.
      const column = ref ? columnIndex(ref) : row.length;
      while (row.length < column) row.push("");
      row[column] = cellValue(attribute(attributes, "t"), cellMatch[2] ?? "", sharedStrings);
    }
    rows.push(row);
  }
  return rows;
}

function parseSharedStrings(xml: string): string[] {
  // A shared string can be split into several formatted runs, each with its own <t>.
  return Array.from(xml.matchAll(SHARED_STRING_RE), (match) => joinText(match[1]));
}

function cellValue(type: string | null, inner: string, sharedStrings: string[]): string {
  if (type === "inlineStr") return joinText(inner);
  const raw = inner.match(VALUE_RE)?.[1];
  if (raw === undefined) return "";
  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  return decodeXml(raw);
}

function joinText(xml: string): string {
  return Array.from(xml.matchAll(TEXT_RE), (match) => decodeXml(match[1])).join("");
}

function attribute(attributes: string, name: string): string | null {
  return attributes.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;
}

/** "A1" → 0, "J12" → 9, "AA3" → 26 */
export function columnIndex(cellRef: string): number {
  const letters = cellRef.match(/^[A-Z]+/)?.[0] ?? "A";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&"); // last, so "&amp;lt;" stays "&lt;"
}
