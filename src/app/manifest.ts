import type { MetadataRoute } from "next";
import { t } from "@/lib/i18n";

/** Web app manifest (/manifest.webmanifest): what "Add to home screen" installs. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: t.app.name,
    short_name: t.app.shortName,
    description: t.app.description,
    lang: "fr-CA",
    start_url: "/",
    scope: "/",
    // Opens like an app: no browser address bar.
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops this one to its own shape (circle, squircle…).
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
