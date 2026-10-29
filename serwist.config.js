// Builds the service worker (src/sw/sw.ts → public/sw.js) after `next build`,
// with the list of files to keep for offline use. See package.json "build".
import { serwist } from "@serwist/next/config";

export default serwist({
  swSrc: "src/sw/sw.ts",
  swDest: "public/sw.js",
  // Pages prerendered at build time (offline page, home shell, legal pages…).
  precachePrerendered: true,
  globIgnores: [
    "**/*.map",
    // The map worker (500 kB) is useless offline (tiles aren't kept): cached on
    // first use instead (src/features/pwa/cache-policy.ts).
    "public/maplibre/**",
    // Shells of dynamic routes ("/trajet/[id]"): not pages anyone can open.
    "**/\\[*\\]*.html",
  ],
});
