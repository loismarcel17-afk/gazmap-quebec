// Performance budget (CLAUDE.md): the home page is usable — prices on the map —
// in under 3 s on an average phone in 4G, on a first visit (nothing cached).
// "Average phone in 4G" = Lighthouse's mobile preset: 1.6 Mbit/s down,
// 750 kbit/s up, 150 ms latency, CPU 4× slower than this computer.
import { expect, test } from "@playwright/test";

const BUDGET_MS = 3_000;

// First visit: no service worker, no cache.
test.use({ serviceWorkers: "block" });

test("home page usable in under 3 s on a phone in 4G", async ({ page, context, request }) => {
  // Warm the server first: in production the CDN already holds the page and the
  // station list; a cold local server is not what visitors meet.
  for (const path of ["/", "/api/stations"]) await request.get(path);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 1.6e6 / 8,
    uploadThroughput: 750e3 / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const start = Date.now();
  await page.goto("/");
  await expect(page.getByText(/Indiquez votre position/)).toBeVisible({ timeout: 15_000 });
  const usableMs = Date.now() - start;

  const transferredKb = await page.evaluate(
    () =>
      performance
        .getEntriesByType("resource")
        .concat(performance.getEntriesByType("navigation"))
        .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).transferSize, 0) / 1024,
  );
  test.info().annotations.push({ type: "performance", description: `${usableMs} ms, ${Math.round(transferredKb)} kB` });
  console.log(`Home usable in ${usableMs} ms (${Math.round(transferredKb)} kB transferred)`);
  expect(usableMs).toBeLessThan(BUDGET_MS);
});
