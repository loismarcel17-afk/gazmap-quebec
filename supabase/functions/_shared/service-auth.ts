// Only the server may run an import: pg_cron (Vault key) or a developer with the
// service_role key. Visitors hold the public anon key, which is also a valid
// Supabase JWT, so "has a valid token" is not enough: the role must be service_role.
//
// The signature is checked by Supabase's gateway before the function runs
// (verify_jwt = true for these functions in supabase/config.toml: never turn it
// off). Here we only read the role claim of that already-verified token.
// Comparing with the SUPABASE_SERVICE_ROLE_KEY variable instead breaks on newer
// projects, where that variable no longer holds the same key as the dashboard.

/** The service_role token of the request, or null if the caller isn't the server. */
export function serviceRoleToken(authorization: string | null): string | null {
  const token = authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return null;
  return jwtRole(token) === "service_role" ? token : null;
}

function jwtRole(token: string): unknown {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="))) as { role?: unknown })
      .role;
  } catch {
    return null;
  }
}
