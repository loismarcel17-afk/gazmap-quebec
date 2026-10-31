// Request limits for the routes that call a paid API (Mapbox), so a script
// calling them in a loop can't run up the bill. Pure logic, clock injected.
//
// Fixed windows: at most `limit` requests per key per `windowMs`. The counters
// live in the server's memory, so each server instance counts on its own: it
// stops a loop from one address, not a distributed attack. The host's firewall
// (docs/DEPLOIEMENT.md) and Mapbox's spending cap cover the rest.

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  /** Bound on remembered keys, so memory can't grow without limit */
  maxKeys?: number;
  now?: () => number;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterS: number };

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export function createRateLimiter({ limit, windowMs, maxKeys = 10_000, now = Date.now }: RateLimitOptions): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  function forgetExpired(at: number) {
    for (const [key, window] of windows) if (at - window.start >= windowMs) windows.delete(key);
    // Still full (many addresses at once): drop the oldest; a Map keeps insertion order.
    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break;
      windows.delete(key);
    }
  }

  return {
    check(key) {
      const at = now();
      let window = windows.get(key);
      if (!window || at - window.start >= windowMs) {
        if (!window && windows.size >= maxKeys) forgetExpired(at);
        window = { start: at, count: 0 };
        windows.delete(key); // re-insert: keeps the Map ordered by window start
        windows.set(key, window);
      }
      if (window.count >= limit) {
        return { allowed: false, retryAfterS: Math.max(1, Math.ceil((window.start + windowMs - at) / 1000)) };
      }
      window.count += 1;
      return { allowed: true };
    },
  };
}

/**
 * The visitor's address, as told by the host's proxy. On Netlify only
 * x-nf-client-connection-ip is guaranteed: its x-forwarded-for holds several
 * addresses, and a visitor can add their own. x-forwarded-for and x-real-ip
 * remain for other proxies. Only used as a counter key in memory: never logged
 * nor stored.
 */
export function clientAddress(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
