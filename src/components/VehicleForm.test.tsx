// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChosenModel } from "@/features/vehicle/profile";
import { useVehicleStore } from "@/lib/vehicle-store";
import { VehicleForm } from "./VehicleForm";

const variant = (id: number, model: string, engineL: number, transmission: string, combined: number): ChosenModel => ({
  id,
  modelYear: 2026,
  make: "Honda",
  model,
  engineL,
  transmission,
  fuelType: "X",
  combinedLPer100Km: combined,
});

const HONDA_2026 = [
  variant(1, "Civic Sedan", 2, "AV7", 6.7),
  variant(2, "CR-V AWD", 1.5, "AV7", 8.4),
  variant(3, "CR-V AWD", 2, "AV", 6.1),
];

// Replace the API module: the test needs neither Supabase nor the network.
vi.mock("@/lib/vehicles-api", () => ({
  fetchModelYears: async () => [2026, 2025],
  fetchMakes: async () => ["Acura", "Honda"],
  fetchVariants: async () => HONDA_2026,
}));

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <VehicleForm />
    </QueryClientProvider>,
  );
}

const select = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;

async function choose(label: string, value: string) {
  await waitFor(() => expect(select(label).disabled).toBe(false));
  fireEvent.change(select(label), { target: { value } });
}

beforeEach(() => {
  window.localStorage.clear();
  useVehicleStore.getState().reset();
});
afterEach(cleanup);

describe("VehicleForm", () => {
  it("picks year → make → model, and auto-selects a model's only version", async () => {
    setup();
    await choose("Année", "2026");
    await choose("Marque", "Honda");
    await choose("Modèle", "Civic Sedan");

    expect(useVehicleStore.getState().model).toEqual(HONDA_2026[0]);
    expect(screen.queryByLabelText("Version")).toBeNull();
    expect(screen.getByText("Honda Civic Sedan 2026")).toBeDefined();
    expect(screen.getByText("Carburant indiqué par RNCan : ordinaire")).toBeDefined();
  });

  it("asks for the version when a model has several", async () => {
    setup();
    await choose("Année", "2026");
    await choose("Marque", "Honda");
    await choose("Modèle", "CR-V AWD");

    expect(useVehicleStore.getState().model).toBeNull();
    const options = Array.from(select("Version").options).map((option) => option.textContent);
    expect(options).toEqual([
      "Choisir…",
      "1,5 L · AV7 · ordinaire · 8,4 L/100 km",
      "2 L · AV · ordinaire · 6,1 L/100 km",
    ]);

    fireEvent.change(select("Version"), { target: { value: "3" } });
    expect(useVehicleStore.getState().model?.combinedLPer100Km).toBe(6.1);
  });

  it("forgets the vehicle when an earlier choice changes", async () => {
    setup();
    await choose("Année", "2026");
    await choose("Marque", "Honda");
    await choose("Modèle", "Civic Sedan");
    await choose("Année", "2025");

    expect(useVehicleStore.getState().model).toBeNull();
    expect(select("Marque").value).toBe("");
  });

  it("validates the tank size and estimates the fill-up", async () => {
    setup();
    const tank = screen.getByLabelText("Capacité du réservoir");

    fireEvent.change(tank, { target: { value: "5" } });
    expect(useVehicleStore.getState().tankCapacityL).toBeNull();
    expect(tank.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Entrez une capacité entre 20 et 200 L.")).toBeDefined();

    fireEvent.change(tank, { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "1/4" }));
    expect(useVehicleStore.getState()).toMatchObject({ tankCapacityL: 60, currentLevel: 0.25 });
    expect(screen.getByText("Plein estimé : 45 L")).toBeDefined();
  });

  it("estimates 40 L while the tank is unknown", () => {
    setup();
    expect(screen.getByText("Plein estimé : 40 L")).toBeDefined();
  });

  it("removes the vehicle", async () => {
    setup();
    await choose("Année", "2026");
    await choose("Marque", "Honda");
    await choose("Modèle", "Civic Sedan");
    fireEvent.click(screen.getByRole("button", { name: "Retirer mon véhicule" }));

    expect(useVehicleStore.getState()).toMatchObject({ model: null, tankCapacityL: null, currentLevel: null });
    expect(select("Année").value).toBe("");
  });
});
