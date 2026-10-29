"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; userId: string; email: string };

const LOADING: SessionState = { status: "loading" };
let state: SessionState = LOADING;
const listeners = new Set<() => void>();
let started = false;

function set(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** Starts following Supabase's auth state, once, the first time someone listens. */
function start() {
  if (started) return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    // Called right away with the stored session (INITIAL_SESSION), then on every change.
    set(
      session?.user
        ? { status: "signedIn", userId: session.user.id, email: session.user.email ?? "" }
        : { status: "signedOut" },
    );
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Who is signed in. "loading" on the server and until the stored session is read. */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}
