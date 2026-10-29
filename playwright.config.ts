import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // A phone: guidance is used in the car.
    ...devices["Pixel 7"],
    locale: "fr-CA",
    timezoneId: "America/Toronto",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "parcours", testIgnore: /performance\.spec\.ts/ },
    // Timed alone, once the others are done: tests running in parallel would
    // slow this computer down and skew the 4G phone measurement.
    { name: "performance", testMatch: /performance\.spec\.ts/, dependencies: ["parcours"] },
  ],
  // Tests run against a production build, like users get it.
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
