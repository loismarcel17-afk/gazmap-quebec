// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TripRecord } from "@/lib/trips-api";
import { TripHistory } from "./TripHistory";

afterEach(cleanup);

const plain = (text: string | null | undefined) => text?.replace(/[  ]/g, " ");

const TRIPS: TripRecord[] = [
  {
    id: "1",
    fuel: "premium",
    mode: "guidance",
    status: "arrived",
    priceAtStart: 2109,
    startedAt: "2026-10-28T21:30:00Z",
    station: { brand: "Shell", name: null, address: "1 rue A, Québec" },
  },
  {
    id: "2",
    fuel: "regular",
    mode: "external",
    status: "started",
    priceAtStart: 1859,
    startedAt: "2026-10-27T15:00:00Z",
    station: { brand: null, name: "Station du Lac", address: "2 rue B, Rimouski" },
  },
];

describe("TripHistory", () => {
  it("lists trips with station, date, fuel and price at departure", () => {
    render(<TripHistory trips={TRIPS} failed={false} onClear={vi.fn()} />);
    const items = screen.getAllByRole("listitem");
    expect(plain(items[0].textContent)).toBe(
      "ShellArrivé1 rue A, Québec28 octobre 2026 à 17 h 30 · Super à 210,9 ¢/L au départ",
    );
    expect(plain(items[1].textContent)).toContain("Ouvert dans une application de navigation");
    expect(screen.getByText(/Aucune position n'est enregistrée/)).toBeDefined();
  });

  it("asks for confirmation before erasing the history", async () => {
    const onClear = vi.fn(async () => {});
    render(<TripHistory trips={TRIPS} failed={false} onClear={onClear} />);

    fireEvent.click(screen.getByRole("button", { name: "Effacer mon historique" }));
    expect(onClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'effacement de tous mes trajets" }));
    await waitFor(() => expect(onClear).toHaveBeenCalledOnce());
  });

  it("can back out of erasing", () => {
    const onClear = vi.fn();
    render(<TripHistory trips={TRIPS} failed={false} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Effacer mon historique" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByRole("button", { name: "Effacer mon historique" })).toBeDefined();
    expect(onClear).not.toHaveBeenCalled();
  });

  it("explains an empty history", () => {
    render(<TripHistory trips={[]} failed={false} onClear={vi.fn()} />);
    expect(screen.getByText(/Aucun trajet pour l'instant/)).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
