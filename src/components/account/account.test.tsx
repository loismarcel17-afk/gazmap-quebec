// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConsentSummary } from "@/features/account/consents";
import { AccountSettings, DeleteAccount } from "./AccountSettings";
import { ConsentForm } from "./ConsentForm";

// The sign-in form talks to Supabase: replace the API module.
const sendSignInCode = vi.fn();
const verifySignInCode = vi.fn();
vi.mock("@/lib/account-api", () => ({
  sendSignInCode: (email: string, captchaToken: string | null) => sendSignInCode(email, captchaToken),
  verifySignInCode: (email: string, code: string) => verifySignInCode(email, code),
}));
// The anti-robot check (Cloudflare Turnstile) loads a script: replace it too.
const getCaptchaToken = vi.fn(async (): Promise<string | null> => "captcha-token");
vi.mock("@/lib/turnstile", () => ({
  useTurnstile: () => ({ attach: () => {}, getToken: () => getCaptchaToken() }),
}));
const { SignInForm } = await import("./SignInForm");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConsentForm", () => {
  it("starts with BOTH boxes unchecked (Loi 25: no pre-checked consent)", () => {
    render(<ConsentForm onAccept={vi.fn()} onDecline={vi.fn()} />);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes).toHaveLength(2);
    expect(boxes.every((box) => !box.checked)).toBe(true);
  });

  it("requires the terms", async () => {
    const onAccept = vi.fn();
    render(<ConsentForm onAccept={onAccept} onDecline={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Vous devez accepter les conditions d'utilisation pour créer un compte.",
    );
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("accepts the terms without statistics unless the user opts in", async () => {
    const onAccept = vi.fn(async () => {});
    render(<ConsentForm onAccept={onAccept} onDecline={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /conditions d'utilisation/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(onAccept).toHaveBeenCalledWith(false));
  });

  it("records the statistics opt-in when checked", async () => {
    const onAccept = vi.fn(async () => {});
    render(<ConsentForm onAccept={onAccept} onDecline={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /conditions d'utilisation/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Contribuer anonymement aux statistiques" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(onAccept).toHaveBeenCalledWith(true));
  });

  it("links to the terms and the privacy policy", () => {
    render(<ConsentForm onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByRole("link", { name: "conditions d'utilisation" }).getAttribute("href")).toBe("/legal/conditions");
    expect(screen.getByRole("link", { name: "politique de confidentialité" }).getAttribute("href")).toBe(
      "/legal/confidentialite",
    );
  });
});

describe("ConsentForm decline", () => {
  it("says when the account could not be erased", async () => {
    render(<ConsentForm onAccept={vi.fn()} onDecline={vi.fn(async () => Promise.reject(new Error("offline")))} />);
    fireEvent.click(screen.getByRole("button", { name: "Ne pas créer de compte" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Impossible d'annuler la création du compte pour l'instant. Réessayez.",
    );
  });
});

describe("AccountSettings", () => {
  const consents: ConsentSummary = {
    termsAccepted: true,
    termsAcceptedAt: "2026-10-28T20:00:00Z",
    termsEverAccepted: true,
    statistics: true,
    statisticsChangedAt: "2026-10-28T20:05:00Z",
  };

  it("shows when the terms were accepted, and lets the user withdraw statistics", async () => {
    const onStatisticsChange = vi.fn(async () => {});
    render(
      <AccountSettings email="alice@example.com" consents={consents} onStatisticsChange={onStatisticsChange} onSignOut={vi.fn()} />,
    );
    expect(screen.getByText(/Conditions d'utilisation acceptées le 28 octobre 2026/)).toBeDefined();

    const toggle = screen.getByRole("switch", { name: "Contribuer anonymement aux statistiques" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    await waitFor(() => expect(onStatisticsChange).toHaveBeenCalledWith(false));
  });

  it("says when saving the change failed", async () => {
    render(
      <AccountSettings
        email="alice@example.com"
        consents={consents}
        onStatisticsChange={vi.fn(async () => Promise.reject(new Error("offline")))}
        onSignOut={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(await screen.findByText("Impossible d'enregistrer ce changement. Réessayez.")).toBeDefined();
  });

  function renderWithDelete(onDelete: () => Promise<void>) {
    render(<DeleteAccount onDelete={onDelete} />);
  }

  it("deletes the account only after a confirmation", async () => {
    const onDelete = vi.fn(async () => {});
    renderWithDelete(onDelete);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte…" }));
    expect(onDelete).not.toHaveBeenCalled(); // one tap is not enough
    const question = screen.getByRole("heading", { name: "Supprimer votre compte ?" });
    expect(document.activeElement).toBe(question); // focus moves to the question
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
  });

  it("can be cancelled, focus back on the button", () => {
    const onDelete = vi.fn(async () => {});
    renderWithDelete(onDelete);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte…" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Supprimer mon compte…" }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("says when the deletion failed", async () => {
    renderWithDelete(vi.fn(async () => Promise.reject(new Error("offline"))));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte…" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Impossible de supprimer votre compte pour l'instant. Rien n'a été effacé ; réessayez.",
    );
  });
});

describe("SignInForm", () => {
  it("asks for a code for a valid e-mail, then verifies it", async () => {
    sendSignInCode.mockResolvedValue(null);
    verifySignInCode.mockResolvedValue(null);
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Adresse courriel"), { target: { value: " Alice@Example.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Recevoir un code" }));
    await screen.findByLabelText("Code reçu par courriel");
    // With the anti-robot token, which Supabase checks before sending anything.
    expect(sendSignInCode).toHaveBeenCalledWith("alice@example.com", "captcha-token");

    fireEvent.change(screen.getByLabelText("Code reçu par courriel"), { target: { value: "12 34-56" } });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() => expect(verifySignInCode).toHaveBeenCalledWith("alice@example.com", "123456"));
  });

  it("rejects an invalid e-mail without calling the server", () => {
    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Adresse courriel"), { target: { value: "alice@" } });
    fireEvent.click(screen.getByRole("button", { name: "Recevoir un code" }));
    expect(screen.getByRole("alert").textContent).toBe("Entrez une adresse courriel valide.");
    expect(sendSignInCode).not.toHaveBeenCalled();
  });

  it("explains a wrong or expired code", async () => {
    sendSignInCode.mockResolvedValue(null);
    verifySignInCode.mockResolvedValue("invalidCode");
    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Adresse courriel"), { target: { value: "alice@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Recevoir un code" }));
    fireEvent.change(await screen.findByLabelText("Code reçu par courriel"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText(/incorrect ou expiré/)).toBeDefined();
  });

  it("sends nothing when the anti-robot check doesn't complete", async () => {
    getCaptchaToken.mockRejectedValueOnce(new Error("turnstile_timeout"));
    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Adresse courriel"), { target: { value: "alice@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Recevoir un code" }));
    expect(await screen.findByText(/vérification anti-robot n'a pas abouti/)).toBeDefined();
    expect(sendSignInCode).not.toHaveBeenCalled();
  });
});
