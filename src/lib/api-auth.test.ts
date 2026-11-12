import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signedInUser } from "./api-auth";

const getClaims = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getClaims } }) }));

const request = (authorization?: string) =>
  new Request("http://localhost/api/detours", { method: "POST", headers: authorization ? { authorization } : {} });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  getClaims.mockReset();
});

describe("signedInUser", () => {
  it("returns the user id of a verified session token", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", role: "authenticated" } }, error: null });
    expect(await signedInUser(request("Bearer token-1"))).toBe("user-1");
    expect(getClaims).toHaveBeenCalledWith("token-1");
  });

  it("refuses the public anon key, which is a valid token too", async () => {
    getClaims.mockResolvedValue({ data: { claims: { role: "anon" } }, error: null });
    expect(await signedInUser(request("Bearer anon-key"))).toBeNull();
  });

  it("refuses an invalid or expired token", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("invalid JWT") });
    expect(await signedInUser(request("Bearer forged"))).toBeNull();
  });

  it("refuses a malformed token that makes Supabase throw (401, not 500)", async () => {
    getClaims.mockRejectedValue(new Error("Invalid JWT structure"));
    expect(await signedInUser(request("Bearer abc.def.ghi"))).toBeNull();
  });

    it("refuses a request without a token, without asking Supabase", async () => {
    expect(await signedInUser(request())).toBeNull();
    expect(await signedInUser(request("Basic abc"))).toBeNull();
    expect(getClaims).not.toHaveBeenCalled();
  });
});
