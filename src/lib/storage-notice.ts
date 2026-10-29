"use client";

import { useSyncExternalStore } from "react";

// Remembers that the storage notice was read. localStorage, try/catch (CLAUDE.md):
// if storage is blocked, the notice simply shows again next time.
const KEY = "gazmap-storage-notice";
const VERSION = "1";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === VERSION;
  } catch {
    return false;
  }
}

/** Dismissed for good on this device (until the notice's text changes: bump VERSION). */
export function dismissStorageNotice(): void {
  try {
    window.localStorage.setItem(KEY, VERSION);
  } catch {
    // Not remembered: shown again next visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** true once read. Server and first paint: true, so the notice never flashes for those who read it. */
export function useStorageNoticeDismissed(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}
