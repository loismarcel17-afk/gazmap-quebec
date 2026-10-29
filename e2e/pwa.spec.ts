// End-to-end: the site is installable and opens offline (production build only,
// the service worker is off with `npm run dev`).
import { expect, test } from "@playwright/test";

test("installable: manifest, icons and service worker", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "GazMap Québec", start_url: "/", display: "standalone", lang: "fr-CA" });
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  }
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === "maskable")).toBe(true);

  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  // The worker installs and takes over the page.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/sw\.js$/);
});

test("offline: kept pages open, others show the offline page; nothing private is cached", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The precache is filled during install: wait until the offline page is in it.
  await expect
    .poll(() => page.evaluate(async () => Boolean(await caches.match("/hors-ligne", { ignoreSearch: true }))), {
      timeout: 15_000,
    })
    .toBe(true);

  await context.setOffline(true);

  // A page kept at install opens without a network.
  await page.goto("/vehicule");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Home: opens too, and says why prices can't update.
  await page.goto("/");
  await expect(page.getByText("Hors ligne : les prix et les itinéraires ne peuvent pas être mis à jour.")).toBeVisible();
  // A page never kept: the offline page instead of the browser's error.
  await page.goto("/trajet/une-station");
  await expect(page.getByRole("heading", { name: "Vous êtes hors ligne" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();

  // Loi 25: no API answer (positions) and no other domain (Supabase) in the caches.
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(10);
  expect(cached.filter((url) => new URL(url).pathname.startsWith("/api/"))).toEqual([]);
  expect(cached.filter((url) => new URL(url).origin !== new URL(page.url()).origin)).toEqual([]);
});
