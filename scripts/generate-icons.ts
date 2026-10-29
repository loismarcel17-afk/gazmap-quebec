// Renders the SVG icons (public/icons/*.svg) to the PNG sizes phones expect.
// Run after changing an icon: npm run icons
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const OUTPUTS = [
  { svg: "public/icons/icon.svg", size: 192, out: "public/icons/icon-192.png" },
  { svg: "public/icons/icon.svg", size: 512, out: "public/icons/icon-512.png" },
  { svg: "public/icons/maskable.svg", size: 512, out: "public/icons/maskable-512.png" },
  // iOS home screen: square, iOS rounds the corners itself (Next serves it).
  { svg: "public/icons/maskable.svg", size: 180, out: "src/app/apple-icon.png" },
];

const browser = await chromium.launch();
for (const { svg, size, out } of OUTPUTS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const markup = readFileSync(svg, "utf8").replace("<svg ", `<svg width="${size}" height="${size}" `);
  await page.setContent(`<style>*{margin:0}</style>${markup}`);
  await page.screenshot({ path: out, omitBackground: true });
  await page.close();
  console.log(`${out} (${size}×${size})`);
}
await browser.close();
