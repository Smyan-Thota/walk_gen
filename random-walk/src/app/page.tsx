"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouteStore } from "@/store/routeStore";
import type { HillinessPreference } from "@/lib/types";
import RouteForm from "@/components/RouteForm";
import MapView from "@/components/Map";
import StatsPanel from "@/components/StatsPanel";
import StepsList from "@/components/StepsList";
import ErrorBanner from "@/components/ErrorBanner";

const VALID_HILLINESS = new Set(["no_hill", "little_hill", "damon_hill"]);

/** Inner component that reads URL search params and auto-triggers route generation. */
function PageInner() {
  const searchParams = useSearchParams();
  const { setLocation, setMinutes, setHilliness, setLockedSeed, generateRoute } = useRouteStore();

  useEffect(() => {
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const minutesStr = searchParams.get("minutes");
    const hillinessStr = searchParams.get("hilliness");
    const seedStr = searchParams.get("seed");

    if (latStr && lngStr && minutesStr && hillinessStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      const minutes = parseInt(minutesStr, 10);

      if (!isNaN(lat) && !isNaN(lng) && !isNaN(minutes) && VALID_HILLINESS.has(hillinessStr)) {
        setLocation(lat, lng);
        setMinutes(minutes);
        setHilliness(hillinessStr as HillinessPreference);

        if (seedStr) {
          const seed = parseInt(seedStr, 10);
          if (!isNaN(seed)) {
            setLockedSeed(seed);
          }
        }

        generateRoute();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** Main page assembling all UI components. */
export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Suspense>
        <PageInner />
      </Suspense>
      <ErrorBanner />
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Random Walk Generator</h1>
        <RouteForm />
        <MapView />
        <StatsPanel />
        <StepsList />
      </div>
    </main>
  );
}
