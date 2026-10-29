// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rankByTotalCost } from "@/features/recommendation/rank";
import type { NearbyStation } from "@/features/stations/nearby";
import type { Station } from "@/features/stations/types";
import { NearbyList, type FillUpAssumptions } from "./NearbyList";

afterEach(cleanup);

function nearby(id: string, brand: string, price: number, distanceMeters: number, sponsored = false): NearbyStation {
  const station: Station = {
    id,
    name: null,
    brand,
    address: `${id} rue Principale, Rimouski`,
    region: "",
    postalCode: "",
    lat: 48,
    lng: -68,
    prices: { regular: price, premium: null, diesel: null },
    sponsored,
  };
  return { station, price, distanceMeters };
}

// "Esso" is 1 ¢/L cheaper but 15 km away: "Shell", 1 km away, is the better deal.
const RANKED = rankByTotalCost([nearby("far", "Esso", 1849, 15_000), nearby("near", "Shell", 1859, 1_000)]);
const DEFAULTS: FillUpAssumptions = { litres: 40, consumptionLPer100Km: 9.5, hasVehicle: false };
const plain = (text: string | null | undefined) => text?.replace(/[  ]/g, " ");

function setup(results = RANKED, assumptions = DEFAULTS) {
  const props = { onRadiusChange: vi.fn(), onSelect: vi.fn() };
  render(
    <NearbyList
      title="Près de Rimouski"
      results={results}
      assumptions={assumptions}
      radiusKm={25}
      selectedId="far"
      {...props}
    />,
  );
  return props;
}

describe("NearbyList", () => {
  it("lists stations by total fill-up cost, with price per litre and distance", () => {
    setup();
    const items = screen.getAllByRole("listitem");
    expect(plain(items[0].textContent)).toBe("ShellMeilleur choixnear rue Principale, Rimouski· à 1 km74,71 $185,9 ¢/L");
    expect(plain(items[1].textContent)).toBe("Essofar rue Principale, Rimouski· à 15 km79,23 $184,9 ¢/L");
  });

  it("explains the best choice and what it saves versus the cheapest price per litre", () => {
    setup();
    expect(plain(screen.getByText(/aller-retour/).textContent)).toBe(
      "40 L à 185,9 ¢/L + détour 0,35 $ (2 km aller-retour)",
    );
    expect(plain(screen.getByText(/de moins qu/).textContent)).toBe(
      "4,52 $ de moins qu'à la station la moins chère au litre (184,9 ¢/L, à 15 km)",
    );
  });

  it("labels sponsored stations without changing their place", () => {
    const ranked = rankByTotalCost([nearby("far", "Esso", 1849, 15_000, true), nearby("near", "Shell", 1859, 1_000)]);
    setup(ranked);
    const items = screen.getAllByRole("listitem");
    expect(within(items[1]).getByText("Commanditée")).toBeDefined(); // still second
    expect(within(items[0]).queryByText("Commanditée")).toBeNull();
  });

  it("is honest about estimates and defaults, and invites to add a vehicle", () => {
    setup();
    expect(screen.getByText(/Détours estimés à vol d'oiseau/)).toBeDefined();
    expect(screen.getByText(/40 L à 9,5 L\/100 km/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Ajouter mon véhicule pour un calcul précis" }).getAttribute("href")).toBe(
      "/vehicule",
    );
  });

  it("shows the vehicle's numbers when there is one", () => {
    setup(RANKED, { litres: 45, consumptionLPer100Km: 6.7, hasVehicle: true });
    expect(screen.getByText(/Plein de 45 L à 6,7 L\/100 km/)).toBeDefined();
    expect(screen.queryByRole("link", { name: /Ajouter mon véhicule/ })).toBeNull();
  });

  it("marks the selected station and reports clicks", () => {
    const { onSelect } = setup();
    const items = screen.getAllByRole("listitem");
    expect(within(items[1]).getByRole("button").getAttribute("aria-current")).toBe("true");
    fireEvent.click(within(items[0]).getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("near");
  });

  it("changes the radius", () => {
    const { onRadiusChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "50 km" }));
    expect(onRadiusChange).toHaveBeenCalledWith(50);
  });

  it("offers a wider radius when nothing is found", () => {
    const { onRadiusChange } = setup([]);
    expect(screen.getByText("Aucune station ne vend ce carburant à moins de 25 km.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Chercher à 50 km" }));
    expect(onRadiusChange).toHaveBeenCalledWith(50);
  });
});
