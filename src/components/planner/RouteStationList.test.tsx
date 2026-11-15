// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rankAlongRoute } from "@/features/recommendation/rank";
import type { NearbyStation } from "@/features/stations/nearby";
import type { Station } from "@/features/stations/types";
import { RouteStationList } from "./RouteStationList";

afterEach(cleanup);

function along(id: string, brand: string, price: number, distanceFromRoute: number): NearbyStation {
  const station: Station = {
    id,
    name: null,
    brand,
    address: `${id}, Drummondville`,
    region: "",
    postalCode: "",
    lat: 45.9,
    lng: -72.5,
    prices: { regular: price, premium: null, diesel: null },
  };
  return { station, price, distanceMeters: distanceFromRoute };
}

const ASSUMPTIONS = { litres: 40, consumptionLPer100Km: 9.5, hasVehicle: true };
const plain = (text: string | null | undefined) => text?.replace(/[\u00a0\u202f]/g, " ");

describe("RouteStationList", () => {
  it("shows the best station first, with its detour against the direct route", () => {
    const results = rankAlongRoute([along("exit", "Esso", 1839, 4_000), along("way", "Shell", 1859, 100)], {}, {
      directMeters: 250_000,
      viaMeters: { exit: 259_000, way: 250_100 },
    });
    const onSelect = vi.fn();
    render(
      <RouteStationList title="Sur la route vers Québec" results={results} assumptions={ASSUMPTIONS} selectedId={null} onSelect={onSelect} />,
    );

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("Shell")).toBeTruthy();
    expect(within(items[0]).getByText(/sur la route/)).toBeTruthy();
    expect(plain(items[1].textContent)).toContain("détour 9 km");
    expect(screen.getByText(/Détours mesurés par la route/)).toBeTruthy();

    fireEvent.click(within(items[1]).getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("exit");
  });

  it("says when estimates are shown and when nothing is on the way", () => {
    const { unmount } = render(
      <RouteStationList title="t" results={rankAlongRoute([along("a", "Ultramar", 1859, 500)])} assumptions={ASSUMPTIONS} selectedId={null} onSelect={() => {}} />,
    );
    expect(screen.getByText(/Détours estimés/)).toBeTruthy();
    unmount();

    render(<RouteStationList title="t" results={[]} assumptions={ASSUMPTIONS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText(/Essayez « À destination »/)).toBeTruthy();
  });
});
