import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import { Providers } from "@/components/Providers";
import { t } from "@/lib/i18n";
import "./globals.css";

// next/font downloads the font at build time and serves it from our own domain:
// no request to Google from the visitor's browser (Loi 25).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.description,
  applicationName: t.app.name,
  // iOS "Add to Home Screen": opens full screen, under this name.
  appleWebApp: { capable: true, title: t.app.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr-CA" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
