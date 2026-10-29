// Accessibility (WCAG 2.1 AA) of every page, checked by axe-core: contrast,
// labels, roles, headings, landmarks… Run against the production build.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", ready: /stations affichées/ },
  { path: "/vehicule", ready: null },
  { path: "/compte", ready: /Recevoir un code/ },
  { path: "/legal/conditions", ready: null },
  { path: "/legal/confidentialite", ready: null },
  { path: "/hors-ligne", ready: null },
  { path: "/trajet/demo-station", ready: /Avant de partir/ },
  { path: "/retour/demo-station?carburant=ordinaire", ready: /Avez-vous fait le plein/ },
];

// The demo station, as Supabase would return it (one object or a list).
const STATION = {
  id: "demo-station",
  lat: 45.51,
  lng: -73.56,
  name: "Station démo",
  brand: "Shell",
  price_regular: 1859,
  price_premium: 2109,
  price_diesel: null,
};

for (const { path, ready } of PAGES) {
  test(`WCAG AA: ${path}`, async ({ page }) => {
    await page.route("**/rest/v1/stations?*id=eq.demo-station*", (route) => route.fulfill({ json: STATION }));
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("main")).first()).toBeVisible();
    if (ready) await expect(page.getByText(ready).first()).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      // The map canvas is drawn by MapLibre; its markers have their own list view.
      .exclude(".maplibregl-canvas")
      .analyze();
    const summary = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    expect(summary).toEqual([]);
  });
}
