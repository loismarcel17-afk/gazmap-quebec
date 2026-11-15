// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Station } from "@/features/stations/types";

let session: { status: string } = { status: "signedIn" };
vi.mock("@/lib/session", () => ({ useSession: () => session }));

// A 100 km trip due east; two stations near the line, one far from it.
const A = { lat: 45.5, lng: -73.6, label: "Montréal" };
const B = { lat: 45.5, lng: -72.32, label: "Granby" };
function station(id: string, brand: string, lat: number, lng: number, regular: number): Station {
  return { id, name: null, brand, address: `${id}, QC`, region: "", postalCode: "", lat, lng, prices: { regular, premium: null, diesel: null } };
}
const STATIONS = [
  station("on-way", "Shell", 45.501, -73.0, 1859),
  station("off-way", "Esso", 45.53, -72.9, 1849),
  station("far", "Ultramar", 46.5, -73.0, 1700),
  station("at-b", "Petro-Canada", 45.505, -72.33, 1869),
];
vi.mock("@/lib/stations-api", () => ({
  fetchStationsSnapshot: async () => ({ updatedAt: "2026-11-14T12:00:00Z", stations: STATIONS }),
}));

const searchAddresses = vi.fn();
const fetchPlannedRoute = vi.fn();
const fetchRouteDetours = vi.fn();
vi.mock("@/lib/planner-api", () => ({
  searchAddresses: (...args: unknown[]) => searchAddresses(...args),
  fetchPlannedRoute: (...args: unknown[]) => fetchPlannedRoute(...args),
  fetchRouteDetours: (...args: unknown[]) => fetchRouteDetours(...args),
}));
vi.mock("@/lib/road-distances", () => ({ fetchRoadDistances: async () => null }));
// The real map needs WebGL.
vi.mock("../station-map/StationMap", () => ({ default: () => <div data-testid="map" /> }));

const { PlannerView } = await import("./PlannerView");

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PlannerView />
    </QueryClientProvider>,
  );
}

async function pickAddress(field: string, typed: string, suggestion: { label: string }) {
  searchAddresses.mockResolvedValueOnce([suggestion]);
  fireEvent.change(screen.getByRole("combobox", { name: field }), { target: { value: typed } });
  // After the typing pause (400 ms), the suggestion comes back from the (mocked) server.
  fireEvent.click(await screen.findByRole("option", { name: suggestion.label }, { timeout: 2000 }));
}

beforeEach(() => {
  session = { status: "signedIn" };
  fetchPlannedRoute.mockResolvedValue({
    geometry: [
      [A.lng, A.lat],
      [B.lng, B.lat],
    ],
    distanceMeters: 100_000,
    durationSeconds: 3_900,
  });
  fetchRouteDetours.mockResolvedValue({
    directMeters: 100_000,
    viaMeters: { "on-way": 100_200, "off-way": 108_000, "at-b": 100_400 },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("PlannerView", () => {
  it("invites visitors without an account to sign in", () => {
    session = { status: "signedOut" };
    setup();
    expect(screen.getByRole("link", { name: "Se connecter" }).getAttribute("href")).toBe("/compte");
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("asks where to fill up once both ends are known, then lists the stations on the way", async () => {
    setup();
    expect(screen.queryByText("Où voulez-vous faire le plein ?")).toBeNull();

    await pickAddress("Départ", "Montr", A);
    await pickAddress("Destination", "Granb", B);
    // The destination search favors results near the departure.
    expect(searchAddresses).toHaveBeenLastCalledWith("Granb", expect.objectContaining({ lat: A.lat, lng: A.lng }));

    fireEvent.click(screen.getByRole("button", { name: /En chemin/ }));

    const list = await screen.findByRole("region", { name: "Sur la route vers Granby" });
    const rows = within(list).getAllByRole("listitem");
    // Shell is right on the way; Esso is 1 ¢ cheaper but 8 km of detour. Ultramar is 100 km away: not listed.
    expect(within(rows[0]).getByText("Shell")).toBeTruthy();
    expect(within(list).queryByText("Ultramar")).toBeNull();
    expect(fetchPlannedRoute).toHaveBeenCalledWith(expect.objectContaining({ lat: A.lat }), expect.objectContaining({ lat: B.lat }));

    // Picking a station and "Y aller" keeps the destination on the device, for the last leg.
    fireEvent.click(within(rows[0]).getByRole("button"));
    fireEvent.click(screen.getByRole("link", { name: "Y aller" }));
    expect(JSON.parse(window.localStorage.getItem("gazmap-planned-trip")!)).toMatchObject({ label: "Granby" });
  });

  it("lists the stations around the destination when chosen", async () => {
    setup();
    await pickAddress("Départ", "Montr", A);
    await pickAddress("Destination", "Granb", B);
    fireEvent.click(screen.getByRole("button", { name: /À destination/ }));

    const list = await screen.findByRole("region", { name: "Près de Granby" });
    expect(within(list).getAllByText("Petro-Canada").length).toBeGreaterThan(0);
    expect(within(list).queryByText("Shell")).toBeNull();
    // No route needed for this choice: no billed Mapbox call for it.
    expect(fetchPlannedRoute).not.toHaveBeenCalled();
  });
});
