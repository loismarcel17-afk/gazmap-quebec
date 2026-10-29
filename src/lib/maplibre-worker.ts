// Imported for its side effect by every map component, before any map is created.
//
// MapLibre v6 loads its Web Worker from a file next to its own module. Once
// Next.js bundles MapLibre into a hashed chunk that file isn't there anymore, so
// we serve it from public/ (scripts/copy-maplibre-worker.ts). ?v= makes browsers
// fetch the new worker after a MapLibre upgrade instead of a cached old one.
import { getVersion, setWorkerUrl } from "maplibre-gl";
import { MAPLIBRE_WORKER_PATH } from "./map";

setWorkerUrl(`${MAPLIBRE_WORKER_PATH}?v=${getVersion()}`);
