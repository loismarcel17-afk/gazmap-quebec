// Screen Wake Lock: keeps the screen on during guidance.
// The browser releases it by itself when the page is hidden; the guidance
// screen asks again on visibilitychange.

export function wakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

export interface ScreenWakeLock {
  /** true if the screen will stay on; false if refused (low battery, policy…) */
  acquire: () => Promise<boolean>;
  release: () => Promise<void>;
}

export function createScreenWakeLock(): ScreenWakeLock {
  let sentinel: WakeLockSentinel | null = null;
  return {
    async acquire() {
      if (!wakeLockSupported()) return false;
      if (sentinel && !sentinel.released) return true;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        return true;
      } catch {
        sentinel = null;
        return false;
      }
    },
    async release() {
      const current = sentinel;
      sentinel = null;
      try {
        await current?.release();
      } catch {
        // already released by the browser
      }
    },
  };
}
