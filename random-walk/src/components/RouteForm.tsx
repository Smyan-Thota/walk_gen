"use client";

import { useState } from "react";
import { useRouteStore } from "@/store/routeStore";
import type { HillinessPreference } from "@/lib/types";

/** Route configuration form with location, time, and hilliness inputs. */
export default function RouteForm() {
  const {
    lat,
    lng,
    minutes,
    hilliness,
    lockedSeed,
    routeResult,
    isLoading,
    setLocation,
    setMinutes,
    setHilliness,
    setLockedSeed,
    generateRoute,
    regenerateRoute,
  } = useRouteStore();

  const [locationMode, setLocationMode] = useState<"gps" | "manual">("gps");
  const [addressInput, setAddressInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /** Request the browser's geolocation. */
  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationMode("manual");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocationMode("manual");
      }
    );
  }

  /** Geocode an address or raw lat,lng using Nominatim. */
  async function handleGeocode() {
    const trimmed = addressInput.trim();
    if (!trimmed) return;

    // Check for raw lat,lng format
    const latLngMatch = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (latLngMatch) {
      const parsedLat = parseFloat(latLngMatch[1]);
      const parsedLng = parseFloat(latLngMatch[2]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        setLocation(parsedLat, parsedLng);
        return;
      }
    }

    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1`,
        {
          headers: { "User-Agent": "RandomWalkGenerator/1.0" },
        }
      );
      const data = (await res.json()) as { lat: string; lon: string }[];
      if (data.length > 0) {
        setLocation(parseFloat(data[0].lat), parseFloat(data[0].lon));
      }
    } catch {
      // Geocoding failed silently
    } finally {
      setGeocoding(false);
    }
  }

  /** Copy shareable link to clipboard. */
  function handleShare() {
    if (!routeResult || lat === null || lng === null) return;
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      minutes: String(minutes),
      hilliness,
      seed: String(routeResult.candidate.seed),
    });
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    navigator.clipboard.writeText(url).then(() => {
      setToast("Link copied!");
      setTimeout(() => setToast(null), 2000);
    });
  }

  const hasLocation = lat !== null && lng !== null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Location */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Starting location</label>
        {locationMode === "gps" ? (
          <div className="flex gap-2 items-center">
            <button
              onClick={handleUseMyLocation}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
            >
              Use my location
            </button>
            <button
              onClick={() => setLocationMode("manual")}
              className="text-sm text-blue-600 hover:underline"
            >
              Enter manually
            </button>
            {hasLocation && (
              <span className="text-xs text-gray-500">
                {lat!.toFixed(4)}, {lng!.toFixed(4)}
              </span>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Address or lat, lng"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGeocode()}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <button
              onClick={handleGeocode}
              disabled={geocoding}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {geocoding ? "..." : "Search"}
            </button>
            <button
              onClick={() => setLocationMode("gps")}
              className="text-sm text-blue-600 hover:underline"
            >
              GPS
            </button>
          </div>
        )}
        {hasLocation && locationMode === "manual" && (
          <p className="text-xs text-gray-500">
            Location set: {lat!.toFixed(4)}, {lng!.toFixed(4)}
          </p>
        )}
      </div>

      {/* Minutes */}
      <div>
        <label htmlFor="minutes" className="block text-sm font-medium text-gray-700">
          Walk time (minutes)
        </label>
        <input
          id="minutes"
          type="number"
          min={5}
          max={180}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="mt-1 border border-gray-300 rounded px-3 py-2 text-sm w-24"
        />
      </div>

      {/* Hilliness */}
      <div>
        <label htmlFor="hilliness" className="block text-sm font-medium text-gray-700">
          Hilliness preference
        </label>
        <select
          id="hilliness"
          value={hilliness}
          onChange={(e) => setHilliness(e.target.value as HillinessPreference)}
          className="mt-1 border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="no_hill">Flat (no hills)</option>
          <option value="little_hill">Some hills</option>
          <option value="damon_hill">Maximum hills (Damon Hill)</option>
        </select>
      </div>

      {/* Advanced */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-gray-500 hover:underline"
        >
          {showAdvanced ? "Hide advanced" : "Advanced options"}
        </button>
        {showAdvanced && (
          <label className="flex items-center gap-2 mt-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={lockedSeed !== null}
              onChange={(e) => {
                if (e.target.checked) {
                  setLockedSeed(routeResult?.candidate.seed ?? Math.floor(Math.random() * 2147483647));
                } else {
                  setLockedSeed(null);
                }
              }}
            />
            Lock seed (reproduce same route)
          </label>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => generateRoute()}
          disabled={isLoading || !hasLocation}
          className="bg-green-600 text-white text-sm px-5 py-2 rounded font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading && (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          Generate Route
        </button>

        {routeResult && (
          <>
            <button
              onClick={() => regenerateRoute()}
              disabled={isLoading}
              className="bg-gray-600 text-white text-sm px-4 py-2 rounded font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              Regenerate
            </button>
            <button
              onClick={handleShare}
              className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded font-medium hover:bg-gray-50"
            >
              Share
            </button>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          {toast}
        </div>
      )}
    </div>
  );
}
