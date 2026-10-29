// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const submitFillUp = vi.fn();
vi.mock("@/lib/feedback-api", () => ({
  submitFillUp: (tripId: string, answer: unknown) => submitFillUp(tripId, answer),
  fetchStationPrices: async () => ({ brand: "Shell", name: null, prices: { regular: 1859, premium: 2109, diesel: null } }),
}));
let session: { status: string; userId?: string; email?: string } = { status: "signedIn", userId: "u1", email: "a@b.ca" };
vi.mock("@/lib/session", () => ({ useSession: () => session }));

const { FeedbackCard } = await import("./FeedbackCard");

const TRIP = "aaaaaaaa-0000-0000-0000-000000000001";
const plain = (text: string | null | undefined) => text?.replace(/[  ]/g, " ");

function setup(tripId: string | null = TRIP) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FeedbackCard stationId="s1" tripId={tripId} initialFuel="regular" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  session = { status: "signedIn", userId: "u1", email: "a@b.ca" };
  submitFillUp.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FeedbackCard", () => {
  it("confirms the displayed price in one tap", async () => {
    setup();
    expect(await screen.findByRole("heading", { name: "Avez-vous fait le plein chez Shell ?" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Oui" }));

    const sameButton = await screen.findByRole("button", { name: /C'est le bon prix/ });
    expect(plain(sameButton.textContent)).toBe("C'est le bon prix (185,9 ¢/L)");
    fireEvent.click(sameButton);

    await waitFor(() => expect(submitFillUp).toHaveBeenCalledWith(TRIP, { filled: true, fuel: "regular", pricePaid: 1859 }));
    expect(await screen.findByText("Merci !")).toBeDefined();
  });

  it("records a corrected price and another fuel", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Oui" }));
    fireEvent.click(await screen.findByRole("button", { name: "Super" }));
    const price = screen.getByLabelText("Prix payé au litre") as HTMLInputElement;
    expect(price.value).toBe("210,9"); // follows the selected fuel's displayed price
    fireEvent.change(price, { target: { value: "208,9" } });
    expect(screen.queryByRole("button", { name: /C'est le bon prix/ })).toBeNull(); // edited: no shortcut
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(submitFillUp).toHaveBeenCalledWith(TRIP, { filled: true, fuel: "premium", pricePaid: 2089 }));
  });

  it("rejects an unreadable price", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Oui" }));
    fireEvent.change(await screen.findByLabelText("Prix payé au litre"), { target: { value: "cher" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(screen.getByText("Entrez le prix au litre, par exemple 185,9.")).toBeDefined();
    expect(submitFillUp).not.toHaveBeenCalled();
  });

  it("records 'not this time'", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Pas cette fois" }));
    await waitFor(() => expect(submitFillUp).toHaveBeenCalledWith(TRIP, { filled: false }));
    expect(await screen.findByText("Bonne route !")).toBeDefined();
  });

  it("says when the trip was already answered", async () => {
    submitFillUp.mockRejectedValue({ code: "23505" });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Pas cette fois" }));
    expect(await screen.findByText("Merci, votre réponse pour ce trajet est déjà enregistrée.")).toBeDefined();
  });

  it("without an account: saves nothing, thanks and invites to create one", async () => {
    session = { status: "signedOut" };
    setup(null);
    fireEvent.click(await screen.findByRole("button", { name: "Oui" }));
    expect(await screen.findByRole("link", { name: "Créer un compte" })).toBeDefined();
    expect(submitFillUp).not.toHaveBeenCalled();
  });
});
