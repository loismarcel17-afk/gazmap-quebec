import { supabase } from "./supabase";

/**
 * POST JSON to one of our account-only API routes, with the session's access
 * token (checked on the server by signedInUser). null when signed out, offline,
 * or the route answered an error: callers show a fallback, never an exception.
 */
export async function postSignedIn<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}
