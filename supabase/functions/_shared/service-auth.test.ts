import { describe, expect, it } from "vitest";
import { serviceRoleToken } from "./service-auth";

// Unsigned test tokens: the signature is the gateway's job, not this function's.
const jwt = (payload: object) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

describe("serviceRoleToken", () => {
  it("accepts the service_role key and returns it for the database client", () => {
    const token = jwt({ iss: "supabase", role: "service_role" });
    expect(serviceRoleToken(`Bearer ${token}`)).toBe(token);
  });

  it("refuses the public anon key and signed-in users' tokens", () => {
    expect(serviceRoleToken(`Bearer ${jwt({ role: "anon" })}`)).toBeNull();
    expect(serviceRoleToken(`Bearer ${jwt({ role: "authenticated", sub: "u1" })}`)).toBeNull();
  });

  it("refuses missing, malformed and non-JWT credentials", () => {
    expect(serviceRoleToken(null)).toBeNull();
    expect(serviceRoleToken("")).toBeNull();
    expect(serviceRoleToken(`Basic ${jwt({ role: "service_role" })}`)).toBeNull();
    expect(serviceRoleToken("Bearer sb_secret_abc")).toBeNull();
    expect(serviceRoleToken("Bearer a.%%%.c")).toBeNull();
  });
});
