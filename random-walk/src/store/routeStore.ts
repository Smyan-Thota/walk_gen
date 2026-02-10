import { create } from "zustand";
import type { HillinessPreference, RouteResult, GenerateRouteResponse } from "@/lib/types";
import { isDuplicate, storeFingerprint } from "@/lib/fingerprint";

/** App-wide state for route generation. */
interface RouteState {
  lat: number | null;
  lng: number | null;
  minutes: number;
  hilliness: HillinessPreference;
  lockedSeed: number | null;

  routeResult: RouteResult | null;
  isLoading: boolean;
  error: string | null;
  errorRetryable: boolean;

  setLocation: (lat: number, lng: number) => void;
  setMinutes: (m: number) => void;
  setHilliness: (h: HillinessPreference) => void;
  setLockedSeed: (s: number | null) => void;
  generateRoute: () => Promise<void>;
  regenerateRoute: () => Promise<void>;
  clearError: () => void;
}

const MAX_DEDUP_RETRIES = 2;

/** Generate a random seed integer. */
function randomSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

export const useRouteStore = create<RouteState>((set, get) => ({
  lat: null,
  lng: null,
  minutes: 30,
  hilliness: "no_hill",
  lockedSeed: null,

  routeResult: null,
  isLoading: false,
  error: null,
  errorRetryable: false,

  setLocation: (lat, lng) => set({ lat, lng }),
  setMinutes: (m) => set({ minutes: m }),
  setHilliness: (h) => set({ hilliness: h }),
  setLockedSeed: (s) => set({ lockedSeed: s }),
  clearError: () => set({ error: null, errorRetryable: false }),

  generateRoute: async () => {
    const { lat, lng, minutes, hilliness, lockedSeed } = get();
    if (lat === null || lng === null) {
      set({ error: "Please set a location first.", errorRetryable: false });
      return;
    }

    set({ isLoading: true, error: null, errorRetryable: false });

    const seed = lockedSeed ?? randomSeed();

    for (let attempt = 0; attempt <= MAX_DEDUP_RETRIES; attempt++) {
      const currentSeed = attempt === 0 ? seed : randomSeed();
      try {
        const res = await fetch("/api/generate-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat,
            lng,
            minutes,
            hilliness,
            seed: currentSeed,
          }),
        });

        const data = (await res.json()) as GenerateRouteResponse;

        if (!data.ok) {
          set({ isLoading: false, error: data.error, errorRetryable: data.retryable });
          return;
        }

        // Dedup check
        if (isDuplicate(data.result.fingerprint) && attempt < MAX_DEDUP_RETRIES) {
          continue;
        }

        storeFingerprint(data.result.fingerprint);
        set({ isLoading: false, routeResult: data.result, error: null });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
        set({ isLoading: false, error: msg, errorRetryable: true });
        return;
      }
    }

    set({ isLoading: false });
  },

  regenerateRoute: async () => {
    const { lockedSeed } = get();
    if (!lockedSeed) {
      set({ lockedSeed: null });
    }
    await get().generateRoute();
  },
}));
