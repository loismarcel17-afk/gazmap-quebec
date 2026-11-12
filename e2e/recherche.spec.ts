// End-to-end, the main journey without an account: read the storage notice,
// search a town, get the nearby stations by price per litre (calculating the
// fill-up needs an account: an invitation leads to sign-in), open one, and head
// there. Stations are served by the test, so the order doesn't depend on today's
// prices. The total-cost ranking (signed in) is covered by unit tests.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { encodeSnapshot } from "../src/features/stations/compact";

const row = (id: string, brand: string, address: string, lat: number, lng: number, price: number) => ({
  id,
  name: null,
  brand,
  address,
  region: "Estrie",
  postal_code: "J1H 1A1",
  lat,
  lng,
  price_regular: price,
  price_premium: price + 250,
  price_diesel: null,
  prices_updated_at: "2026-10-28T18:00:00+00:00",
  sponsored: false,
});

// Orford is the cheapest per litre, but ~7 km away: the detour costs more than it saves.
const STATIONS = [
  row("orford", "Esso", "1 ch. Alfred-DesRochers, Orford", 45.36, -71.97, 1789),
  row("sherbrooke-1", "Shell", "10 rue King O., Sherbrooke", 45.4, -71.9, 1829),
  row("sherbrooke-2", "Ultramar", "20 rue King E., Sherbrooke", 45.402, -71.885, 1899),
];

test.beforeEach(async ({ page }) => {
  // The list (our /api/stations), then one station (the trip page reads Supabase).
  await page.route("**/api/stations", (route) => route.fulfill({ json: encodeSnapshot(STATIONS) }));
  await page.route("**/rest/v1/stations?*", (route) => {
    const id = new URL(route.request().url()).searchParams.get("id")?.replace("eq.", "");
    return route.fulfill({ json: STATIONS.find((s) => s.id === id) });
  });
  // Signed out, the page must never ask for road distances (account only).
  await page.route("**/api/detours", () => {
    throw new Error("/api/detours called without an account");
  });
});

test("search a town, compare prices, open a station and head there", async ({ page }) => {
  await page.goto("/");

  // Before a position: no station on the map, an invitation to give one.
  await expect(page.getByText(/Indiquez votre position/)).toBeVisible();

  // The storage notice: read once, then gone for good.
  const notice = page.getByRole("region", { name: "Témoins et stockage" });
  await expect(notice).toContainText("Aucun témoin publicitaire");
  await notice.getByRole("button", { name: "Compris" }).click();
  await expect(notice).toBeHidden();
  await expect(page.getByRole("link", { name: "Confidentialité" })).toBeVisible();

  // Search by town: computed on the phone, nothing sent anywhere.
  await page.getByRole("combobox").fill("sherb");
  await page.getByRole("option", { name: /Sherbrooke/ }).click();

  // Signed out: by price per litre, prices only (no fill-up cost).
  const list = page.getByRole("list").filter({ hasText: "Ultramar" });
  const items = list.getByRole("listitem");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Esso");
  await expect(items.nth(0)).toContainText("Prix le plus bas");
  await expect(items.nth(0)).toContainText("178,9 ¢/L");
  await expect(items.nth(0)).not.toContainText("$");
  await expect(items.nth(1)).toContainText("Shell");

  // "Calculer mon plein" leads to sign-in.
  await expect(page.getByText("classées par prix au litre")).toBeVisible();
  const calculate = page.getByRole("link", { name: "Calculer mon plein : se connecter" });
  await expect(calculate).toHaveAttribute("href", "/compte");
  await expect(page.getByRole("link", { name: "Calculer mon plein", exact: true })).toHaveAttribute("href", "/compte");

  // Accessibility with the list open.
  const scan = async () =>
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude(".maplibregl-canvas").analyze())
      .violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(await scan()).toEqual([]);

  // The station sheet, then "Y aller".
  await items.nth(0).getByRole("button").click();
  const goThere = page.getByRole("link", { name: /Y aller/ });
  await expect(goThere).toBeVisible();
  expect(await scan()).toEqual([]);
  await goThere.click();
  await expect(page).toHaveURL(/\/trajet\/orford\?carburant=ordinaire$/);
  await expect(page.getByRole("heading", { name: "Avant de partir" })).toBeVisible();

  // The notice stays dismissed on the next visit.
  await page.goto("/");
  await expect(page.getByText(/Indiquez votre position/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Témoins et stockage" })).toHaveCount(0);
});

test("keyboard only: search, choose a station, close it and keep your place", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Indiquez votre position/)).toBeVisible();

  // Type, pick the suggestion with the arrow keys.
  await page.getByRole("combobox").focus();
  await page.keyboard.type("sherb");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const first = page.getByRole("listitem").filter({ hasText: "Shell" }).getByRole("button");
  await expect(first).toBeVisible();

  // Tab until the first station is focused (every stop is a visible control).
  for (let i = 0; i < 30 && !(await first.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(first).toBeFocused();

  // Enter opens the sheet and moves focus into it; Escape closes it and gives focus back.
  await page.keyboard.press("Enter");
  await expect(page.locator("#station-sheet-title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: /Y aller/ })).toBeHidden();
  await expect(first).toBeFocused();
});
