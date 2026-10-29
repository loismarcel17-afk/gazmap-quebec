"use client";

// Cloudflare Turnstile: tells people from robots before a sign-in code is sent,
// so a script can't make us e-mail thousands of addresses. Supabase checks the
// token itself (config.toml [auth.captcha]); we only obtain it.
//
// Loaded only where it serves (the e-mail step of /compte), never on the map.
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY it is off, and so must Supabase's check be.
import { useCallback, useEffect, useRef, useState } from "react";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 20_000;

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      language: string;
      appearance: "interaction-only";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    script.onerror = () => {
      scriptPromise = null; // allow a retry
      reject(new Error("turnstile"));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

export interface Turnstile {
  /** Where the widget goes; it only shows when Cloudflare needs the person to click. */
  attach: (element: HTMLDivElement | null) => void;
  /** A fresh single-use token (waits for it); null when Turnstile is off. Rejects if none comes. */
  getToken(): Promise<string | null>;
}

export function useTurnstile(): Turnstile {
  const enabled = TURNSTILE_SITE_KEY !== "";
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const token = useRef<string | null>(null);
  const waiters = useRef<((token: string) => void)[]>([]);

  useEffect(() => {
    if (!enabled || !element) return;
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled) return;
        const id = api.render(element, {
          sitekey: TURNSTILE_SITE_KEY,
          language: "fr",
          appearance: "interaction-only",
          callback: (value) => {
            token.current = value;
            waiters.current.splice(0).forEach((resolve) => resolve(value));
          },
          "expired-callback": () => (token.current = null),
          "error-callback": () => (token.current = null),
        });
        widget.current = { api, id };
      })
      .catch(() => {
        // Script blocked or offline: getToken() times out and the form says so.
      });
    return () => {
      cancelled = true;
      if (widget.current) widget.current.api.remove(widget.current.id);
      widget.current = null;
      token.current = null;
    };
  }, [enabled, element]);

  const getToken = useCallback(async () => {
    if (!enabled) return null;
    const ready = token.current;
    if (ready) {
      // Single use: ask Cloudflare for the next one right away (for "Renvoyer un code").
      token.current = null;
      if (widget.current) widget.current.api.reset(widget.current.id);
      return ready;
    }
    const value = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("turnstile_timeout")), TOKEN_TIMEOUT_MS);
      waiters.current.push((received) => {
        clearTimeout(timer);
        resolve(received);
      });
    });
    token.current = null;
    if (widget.current) widget.current.api.reset(widget.current.id);
    return value;
  }, [enabled]);

  return { attach: setElement, getToken };
}
