import type { LineString } from "geojson";

/** User's preference for route hilliness. */
export type HillinessPreference = "no_hill" | "little_hill" | "damon_hill";

/** Request body sent to /api/generate-route. */
export interface RouteRequest {
  lat: number;
  lng: number;
  minutes: number;
  hilliness: HillinessPreference;
  seed?: number;
  lockedSeeds?: number[];
}

/** A single scored route candidate from ORS. */
export interface RouteCandidate {
  seed: number;
  distanceM: number;
  durationS: number;
  ascentM: number;
  descentM: number;
  ascentPerKm: number;
  geometry: LineString;
  bbox: [number, number, number, number];
  steps: RouteStep[];
  score: number;
}

/** A single turn-by-turn instruction step. */
export interface RouteStep {
  instruction: string;
  distanceM: number;
  durationS: number;
}

/** The final selected route with metadata. */
export interface RouteResult {
  candidate: RouteCandidate;
  hillinessScore: string;
  targetDistanceM: number;
  fingerprint: string;
}

/** Response shape from /api/generate-route. */
export type GenerateRouteResponse =
  | {
      ok: true;
      result: RouteResult;
    }
  | {
      ok: false;
      error: string;
      retryable: boolean;
    };
