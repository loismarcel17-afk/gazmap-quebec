import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./csp";

const directives = (policy: string) =>
  Object.fromEntries(
    policy.split("; ").map((directive) => {
      const [name, ...values] = directive.split(" ");
      return [name, values];
    }),
  );

describe("contentSecurityPolicy", () => {
  const production = directives(
    contentSecurityPolicy({
      supabaseUrl: "https://abcd.supabase.co",
      mapStyleUrl: "https://tiles.openfreemap.org/styles/liberty",
    }),
  );

  it("only lets the page talk to our own services", () => {
    expect(production["connect-src"]).toEqual([
      "'self'",
      "https://abcd.supabase.co",
      "https://tiles.openfreemap.org",
      "https://challenges.cloudflare.com",
    ]);
    expect(production["default-src"]).toEqual(["'self'"]);
  });

  it("loads no script from another domain except the anti-robot check", () => {
    expect(production["script-src"].filter((source: string) => source.startsWith("http"))).toEqual([
      "https://challenges.cloudflare.com",
    ]);
  });

  it("can't be framed, has no plugins, and upgrades http in production", () => {
    expect(production["frame-ancestors"]).toEqual(["'none'"]);
    expect(production["object-src"]).toEqual(["'none'"]);
    expect(production["upgrade-insecure-requests"]).toEqual([]);
  });

  it("keeps plain http for the local Supabase, and skips unset services", () => {
    const local = directives(contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321" }));
    expect(local["connect-src"]).toEqual(["'self'", "http://127.0.0.1:54321", "https://challenges.cloudflare.com"]);
    expect(local["upgrade-insecure-requests"]).toBeUndefined();
  });
});
