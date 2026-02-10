"use client";

import { useRouteStore } from "@/store/routeStore";

/** Format duration seconds into a human-readable string. */
function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return min > 0 ? `${hr} hr ${min} min` : `${hr} hr`;
}

/** Display route statistics. */
export default function StatsPanel() {
  const routeResult = useRouteStore((s) => s.routeResult);

  if (!routeResult) return null;

  const { candidate, hillinessScore } = routeResult;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
      <div>
        <span className="text-gray-500">Distance</span>
        <p className="font-semibold">{(candidate.distanceM / 1000).toFixed(1)} km</p>
      </div>
      <div>
        <span className="text-gray-500">Est. duration</span>
        <p className="font-semibold">{formatDuration(candidate.durationS)}</p>
      </div>
      <div>
        <span className="text-gray-500">Total ascent</span>
        <p className="font-semibold">{Math.round(candidate.ascentM)} m &#8593;</p>
      </div>
      <div>
        <span className="text-gray-500">Total descent</span>
        <p className="font-semibold">{Math.round(candidate.descentM)} m &#8595;</p>
      </div>
      <div>
        <span className="text-gray-500">Ascent/km</span>
        <p className="font-semibold">{candidate.ascentPerKm.toFixed(1)} m/km</p>
      </div>
      <div>
        <span className="text-gray-500">Hilliness</span>
        <p className="font-semibold">{hillinessScore}</p>
      </div>
    </div>
  );
}
