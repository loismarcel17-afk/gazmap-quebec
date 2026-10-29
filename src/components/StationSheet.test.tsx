// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Station } from "@/features/stations/types";
import { StationSheet } from "./StationSheet";

afterEach(cleanup);

const station: Station = {
  id: "abc",
  name: "Station du Lac",
  brand: null,
  address: "1 rue Principale, Rimouski",
  region: "Bas-Saint-Laurent",
  postalCode: "G5L 1A1",
  lat: 48.45,
  lng: -68.52,
  prices: { regular: 1859, premium: 2109, diesel: null },
};

const plain = (text: string | null) => text?.replace(/[\u00a0\u202f]/g, " ");

describe("StationSheet", () => {
  it("shows the station, its prices and 'Non disponible' for missing fuel", () => {
    render(<StationSheet station={station} fuel="regular" onClose={() => {}} />);

    expect(screen.getByRole("heading", { name: "Station du Lac" })).toBeDefined();
    expect(screen.getByText("Indépendant")).toBeDefined();

    const prices = screen.getByText("Prix au litre").nextElementSibling as HTMLElement;
    expect(plain(within(prices).getByText(/185,9/).textContent)).toBe("185,9 ¢/L");
    expect(plain(within(prices).getByText(/210,9/).textContent)).toBe("210,9 ¢/L");
    expect(within(prices).getByText("Non disponible")).toBeDefined();
  });

  it("closes with the button and with Escape", () => {
    const onClose = vi.fn();
    render(<StationSheet station={station} fuel="regular" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Fermer la fiche de la station" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("moves focus to the station name when opened", () => {
    render(<StationSheet station={station} fuel="regular" onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Station du Lac" }));
  });
});
