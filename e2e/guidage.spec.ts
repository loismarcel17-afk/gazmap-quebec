// End-to-end: drive the Montréal demo route with a simulated GPS and check that
// the feedback card opens on arrival. No Mapbox token or database needed: the
// route and the station are served by the test.
import { expect, test } from "@playwright/test";
import { MONTREAL_DIRECTIONS_RESPONSE, pointAlong, START, STATION } from "../src/features/navigation/fixtures/montreal-route";
import { parseDirections } from "../src/features/routing/directions";

const STATION_ID = "demo-station";

test.use({ permissions: ["geolocation"], geolocation: { latitude: START.lat, longitude: START.lng, accuracy: 8 } });

test("guidance follows the driver and opens the feedback card on arrival", async ({ page, context }) => {
  // The station, as Supabase would return it.
  await page.route("**/rest/v1/stations?*", (route) =>
    route.fulfill({ json: { lat: STATION.lat, lng: STATION.lng, name: "Station démo", brand: "Shell" } }),
  );
  // The route, as /api/itineraire would return it with a Mapbox token.
  const routeRequests: unknown[] = [];
  await page.route("**/api/itineraire", async (route) => {
    routeRequests.push(route.request().postDataJSON());
    await route.fulfill({ json: { route: parseDirections(MONTREAL_DIRECTIONS_RESPONSE) } });
  });

  await page.goto(`/trajet/${STATION_ID}`);

  // Safety message first, then a big start button.
  await expect(page.getByRole("heading", { name: "Avant de partir" })).toBeVisible();
  await expect(page.getByText("Code de la sécurité routière")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ouvrir dans Waze" })).toBeVisible();
  await page.getByRole("button", { name: "Démarrer le guidage" }).click();

  // First fix → route → banner announces the left turn onto Saint-Laurent.
  await expect(page.getByText("Boulevard Saint-Laurent")).toBeVisible();
  await expect(page.getByRole("img", { name: "À gauche" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Arrêter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ouvrir dans Google Maps" })).toBeVisible();

  // Drive: one fix every 50 m, like a car at ~50 km/h with a fix every ~3.5 s (sped up).
  // Last fixes: pulling into the station (the last 50 m step stops exactly 50 m away).
  const drive = [...Array.from({ length: 19 }, (_, i) => (i + 1) * 50), 975, 995];
  for (const meters of drive) {
    await context.setGeolocation({ ...latLng(pointAlong(meters)), accuracy: 8 });
    await page.waitForTimeout(150);
    if (meters === 700) {
      // After the turn, the banner announces the destination.
      await expect(page.getByRole("img", { name: "Arrivée" })).toBeVisible();
    }
  }

  // Within 50 m of the station: the feedback card opens by itself.
  // No account in this test: no trip id, only the fuel to pre-select.
  await expect(page).toHaveURL(new RegExp(`/retour/${STATION_ID}\\?carburant=ordinaire$`));
  await expect(page.getByRole("heading", { name: "Avez-vous fait le plein chez Shell ?" })).toBeVisible();

  // Privacy: a single route request (the start); positions during the drive stayed on the phone.
  expect(routeRequests).toHaveLength(1);
  expect(routeRequests[0]).toMatchObject({ stationId: STATION_ID });
});

test("falls back to Waze / Google Maps when location is refused", async ({ page, context }) => {
  await context.clearPermissions();
  await page.route("**/rest/v1/stations?*", (route) =>
    route.fulfill({ json: { lat: STATION.lat, lng: STATION.lng, name: "Station démo", brand: "Shell" } }),
  );
  await page.goto(`/trajet/${STATION_ID}`);
  await page.getByRole("button", { name: "Démarrer le guidage" }).click();

  await expect(page.getByText("La localisation est refusée")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ouvrir dans Waze" })).toHaveAttribute(
    "href",
    new RegExp(`ll=${STATION.lat.toFixed(6)},${STATION.lng.toFixed(6)}`),
  );
});

function latLng({ lat, lng }: { lat: number; lng: number }) {
  return { latitude: lat, longitude: lng };
}
