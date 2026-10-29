import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  EMPTY_PROFILE,
  sanitizeProfile,
  type ChosenModel,
  type VehicleProfile,
} from "@/features/vehicle/profile";

interface VehicleStore extends VehicleProfile {
  setModel: (model: ChosenModel | null) => void;
  setTankCapacity: (litres: number | null) => void;
  setCurrentLevel: (level: number | null) => void;
  reset: () => void;
}

/**
 * localStorage wrapped in try/catch (CLAUDE.md): it throws in some private-browsing
 * modes, when storage is full, or when the browser blocks site data. The app then
 * keeps working; the profile just isn't remembered.
 */
export const safeLocalStorage: StateStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // not remembered, not fatal
    }
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // idem
    }
  },
};

export const useVehicleStore = create<VehicleStore>()(
  persist(
    (set) => ({
      ...EMPTY_PROFILE,
      setModel: (model) => set({ model }),
      setTankCapacity: (tankCapacityL) => set({ tankCapacityL }),
      setCurrentLevel: (currentLevel) => set({ currentLevel }),
      reset: () => set(EMPTY_PROFILE),
    }),
    {
      name: "gazmap-vehicle",
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      // Only data is saved, not the functions.
      partialize: ({ model, tankCapacityL, currentLevel }) => ({ model, tankCapacityL, currentLevel }),
      // Never trust what comes back from storage.
      merge: (stored, current) => ({ ...current, ...sanitizeProfile(stored) }),
      // Read storage after the first render (Providers calls rehydrate), so the
      // server HTML and the browser's first render match.
      skipHydration: true,
    },
  ),
);

/**
 * true once the saved profile has been read from localStorage. Until then,
 * show nothing profile-dependent rather than a misleading "no vehicle".
 * useSyncExternalStore: React's way to subscribe to state living outside React;
 * the last argument is the value during server rendering (never hydrated there).
 */
export function useVehicleHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useVehicleStore.persist.onFinishHydration(onChange),
    () => useVehicleStore.persist.hasHydrated(),
    () => false,
  );
}
