// MapLibre v6 loads its Web Worker from a file next to its own module
// (./maplibre-gl-worker.mjs). Once Next.js bundles MapLibre into a hashed chunk,
// that file no longer exists there, so we serve it from public/ and point
// MapLibre at it with setWorkerUrl() (see src/lib/map.ts).
// Copied on every dev/build so it always matches the installed maplibre-gl version.
import { copyFileSync, mkdirSync } from "node:fs";

const SOURCE = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
const OUTPUT_DIR = "public/maplibre";

mkdirSync(OUTPUT_DIR, { recursive: true });
copyFileSync(SOURCE, `${OUTPUT_DIR}/maplibre-gl-worker.mjs`);
console.log(`${SOURCE} → ${OUTPUT_DIR}/`);
