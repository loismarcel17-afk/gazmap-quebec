// The service worker: built by `serwist build` (serwist.config.js) into
// public/sw.js after `next build`. Not active with `npm run dev`.
//
// What it keeps on the phone is decided by src/features/pwa/cache-policy.ts
// (unit-tested): our built files and pages, never the API nor Supabase.
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";
import { cachePolicy, type CachePolicy } from "../features/pwa/cache-policy";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    /** Files to download at install, injected by `serwist build` */
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/** Shown when a page is opened offline and no copy of it is kept. */
const OFFLINE_PAGE = "/hors-ligne";

const matches =
  (policy: CachePolicy) =>
  ({ request, url }: { request: Request; url: URL }) =>
    cachePolicy({
      url,
      origin: self.location.origin,
      method: request.method,
      navigate: request.mode === "navigate",
      rsc: request.headers.get("RSC") === "1",
    }) === policy;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new version takes over at once: no tab stuck on old code after a deploy.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // "network-only" has no rule ON PURPOSE: the worker doesn't touch those
    // requests at all (API, Supabase, map tiles); the browser sends them itself.
    {
      matcher: matches("static"),
      handler: new CacheFirst({
        cacheName: "static",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: matches("page"),
      // Online: always the fresh page (3 s at most on a weak signal), then the copy.
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: matches("asset"),
      handler: new StaleWhileRevalidate({
        cacheName: "assets",
        plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
  ],
  fallbacks: {
    entries: [{ url: OFFLINE_PAGE, matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
