// Content-Security-Policy: the browser refuses anything this list doesn't name.
// Built from the configured services, so a new map or Supabase URL updates it.
//
// The trade-off: Next.js writes small inline scripts into every page. Allowing
// them with a per-request nonce would make every page dynamic (no static pages,
// no CDN cache, no 3 s budget), so inline scripts are allowed ('unsafe-inline').
// What the policy still guarantees:
// - no script from another domain (except Cloudflare's anti-robot check);
// - no request to an undeclared domain: even an injected script couldn't send
//   the session or a position anywhere (connect-src, img-src, frame-src);
// - no framing by other sites, no <base> hijack, no plugins.

export interface CspSources {
  /** NEXT_PUBLIC_SUPABASE_URL */
  supabaseUrl?: string;
  /** NEXT_PUBLIC_MAP_STYLE_URL: style, tiles, glyphs and sprites come from its origin */
  mapStyleUrl?: string;
}

const TURNSTILE = "https://challenges.cloudflare.com";

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ supabaseUrl, mapStyleUrl }: CspSources): string {
  const supabase = origin(supabaseUrl);
  const map = origin(mapStyleUrl);
  const list = (...sources: (string | null)[]) => sources.filter((source): source is string => source !== null).join(" ");

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": list("'self'", "'unsafe-inline'", TURNSTILE),
    // Tailwind and MapLibre set inline styles.
    "style-src": "'self' 'unsafe-inline'",
    "img-src": list("'self'", "data:", "blob:", map),
    "font-src": "'self'",
    "connect-src": list("'self'", supabase, map, TURNSTILE),
    // MapLibre's worker is served from /maplibre; it may also start from a blob.
    "worker-src": "'self' blob:",
    // Turnstile shows its check in a frame from Cloudflare.
    "frame-src": TURNSTILE,
    "frame-ancestors": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "object-src": "'none'",
    "manifest-src": "'self'",
  };
  const policy = Object.entries(directives).map(([name, value]) => `${name} ${value}`);
  // In production every service is HTTPS: upgrade any http:// link. Not locally,
  // where Supabase answers on plain http://127.0.0.1.
  if (supabase?.startsWith("https://")) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
