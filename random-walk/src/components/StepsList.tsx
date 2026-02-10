"use client";

import { useState, useEffect } from "react";
import { useRouteStore } from "@/store/routeStore";

/** Format distance in meters to a readable string. */
function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Format duration seconds to a readable string. */
function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  if (min < 1) return "< 1 min";
  return `${min} min`;
}

/** Collapsible turn-by-turn directions list. */
export default function StepsList() {
  const routeResult = useRouteStore((s) => s.routeResult);
  const [expanded, setExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    setExpanded(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      setExpanded(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!routeResult) return null;

  const { steps } = routeResult.candidate;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <span>Turn-by-turn directions ({steps.length} steps)</span>
        <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <ol className="divide-y divide-gray-100 px-4 pb-3">
          {steps.map((step, i) => (
            <li key={i} className="py-2 flex items-start gap-3">
              <span className="text-gray-400 text-xs font-mono mt-0.5 w-5 shrink-0 text-right">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{step.instruction}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDistance(step.distanceM)} &middot; {formatDuration(step.durationS)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
