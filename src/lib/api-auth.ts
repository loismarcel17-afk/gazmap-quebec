// Who is calling an API route: the signed-in user's id, read from the Supabase
// access token the browser sends ("Authorization: Bearer <token>").
import { createClient } from "@supabase/supabase-js";

/**
 * The user id, or null when there is no valid session. getClaims checks the
 * token's signature (against the project's public keys, or with Supabase Auth
 * for older symmetric keys). The public anon key is a valid token too, so the
 * role must be "authenticated".
 */
export async function signedInUser(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data, error } = await client.auth.getClaims(token);
    const claims = data?.claims;
    if (error || !claims || claims.role !== "authenticated" || typeof claims.sub !== "string") return null;
    return claims.sub;
  } catch {
    // A malformed token throws instead of returning an error: still just "not signed in".
    return null;
  }
}
