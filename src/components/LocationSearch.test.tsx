// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Place } from "@/features/places/places";
import { LocationSearch } from "./LocationSearch";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PLACES: Place[] = [
  { kind: "city", key: "rimouski", label: "Rimouski", lat: 48.45, lng: -68.52, stationCount: 12 },
  { kind: "city", key: "rigaud", label: "Rigaud", lat: 45.48, lng: -74.3, stationCount: 3 },
  { kind: "city", key: "montreal", label: "Montréal", lat: 45.5, lng: -73.57, stationCount: 188 },
];

function setup() {
  const onOriginChange = vi.fn();
  render(<LocationSearch places={PLACES} onOriginChange={onOriginChange} />);
  return { onOriginChange, input: screen.getByRole("combobox", { name: "Ville ou code postal" }) };
}

/** Replace navigator.geolocation for one test. */
function stubGeolocation(answer: (success: PositionCallback, failure: PositionErrorCallback) => void) {
  vi.stubGlobal("navigator", {
    ...navigator,
    geolocation: { getCurrentPosition: answer },
  });
}

describe("LocationSearch", () => {
  it("suggests matching places and picks one with the keyboard", () => {
    const { onOriginChange, input } = setup();

    fireEvent.change(input, { target: { value: "ri" } });
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Rimouski12 stations", "Rigaud3 stations"]);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onOriginChange).toHaveBeenCalledWith({ lat: 45.48, lng: -74.3, label: "Rigaud", fromDevice: false });
    expect((input as HTMLInputElement).value).toBe("Rigaud");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("picks a place with a click", () => {
    const { onOriginChange, input } = setup();
    fireEvent.change(input, { target: { value: "mont" } });
    fireEvent.click(screen.getByRole("option", { name: /Montréal/ }));
    expect(onOriginChange).toHaveBeenCalledWith(expect.objectContaining({ label: "Montréal" }));
  });

  it("says so when nothing matches", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("Aucune ville ni code postal trouvé")).toBeDefined();
  });

  it("clears the search and the origin", () => {
    const { onOriginChange, input } = setup();
    fireEvent.change(input, { target: { value: "ri" } });
    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));
    expect((input as HTMLInputElement).value).toBe("");
    expect(onOriginChange).toHaveBeenLastCalledWith(null);
  });

  it("uses the device position when asked", async () => {
    stubGeolocation((success) =>
      success({ coords: { latitude: 46.81, longitude: -71.21 } } as GeolocationPosition),
    );
    const { onOriginChange, input } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Me localiser" }));

    await waitFor(() =>
      expect(onOriginChange).toHaveBeenCalledWith({ lat: 46.81, lng: -71.21, label: "Ma position", fromDevice: true }),
    );
    expect((input as HTMLInputElement).value).toBe("Ma position");
  });

  it("explains a refused permission and suggests typing a place instead", async () => {
    stubGeolocation((_, failure) => failure({ code: 1 } as GeolocationPositionError));
    const { onOriginChange } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Me localiser" }));

    expect(
      await screen.findByText("Localisation refusée. Entrez plutôt une ville ou un code postal."),
    ).toBeDefined();
    expect(onOriginChange).not.toHaveBeenCalled();
  });
});
