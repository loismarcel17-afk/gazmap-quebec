import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./src/features/security/csp";

// Sent with every page and file. HSTS is added by Vercel on HTTPS domains.
const SECURITY_HEADERS = [
  // Never guess a file's type (a text file can't be run as a script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites can't show this one in a frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Other sites see only our domain, never the page (a station id, a trip).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location and screen wake lock for our own pages only; nothing else.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), screen-wake-lock=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  // What the browser may load and contact (src/features/security/csp.ts).
  // Production builds only: the dev server needs eval and a websocket for reloads.
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Content-Security-Policy",
          value: contentSecurityPolicy({
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
          }),
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // No "X-Powered-By: Next.js": nothing to tell about the server.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // The service worker must always be checked for a new version.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
