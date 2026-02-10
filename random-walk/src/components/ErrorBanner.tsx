"use client";

import { useRouteStore } from "@/store/routeStore";

/** Dismissible error banner with optional retry button. */
export default function ErrorBanner() {
  const error = useRouteStore((s) => s.error);
  const retryable = useRouteStore((s) => s.errorRetryable);
  const generateRoute = useRouteStore((s) => s.generateRoute);
  const clearError = useRouteStore((s) => s.clearError);

  if (!error) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-sm flex-1">{error}</p>
      <div className="flex items-center gap-2 shrink-0">
        {retryable && (
          <button
            onClick={() => generateRoute()}
            className="text-sm bg-white text-red-600 px-3 py-1 rounded font-medium hover:bg-red-50"
          >
            Retry
          </button>
        )}
        <button
          onClick={clearError}
          className="text-white hover:text-red-200 text-lg leading-none"
          aria-label="Dismiss error"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
