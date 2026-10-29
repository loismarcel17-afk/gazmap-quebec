"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useVehicleStore } from "@/lib/vehicle-store";

export function Providers({ children }: { children: ReactNode }) {
  // useState: one QueryClient per browser tab, created once, never shared between
  // visitors (which a module-level constant would do during server rendering).
  const [queryClient] = useState(() => new QueryClient());

  // Read the saved vehicle profile once the page is in the browser (see vehicle-store).
  useEffect(() => {
    void useVehicleStore.persist.rehydrate();
  }, []);

  // The service worker (public/sw.js, built by `serwist build`) makes the site
  // installable and opens it offline. Production only: in development it would
  // serve stale copies of the pages being edited.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not installed: the site works as before, just not offline.
    });
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
