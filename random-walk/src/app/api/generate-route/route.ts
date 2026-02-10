import { NextResponse } from "next/server";
import type { RouteRequest, GenerateRouteResponse, HillinessPreference } from "@/lib/types";
import {
  DEFAULT_WALKING_SPEED_MPS,
  MIN_WALK_MINUTES,
  MAX_WALK_MINUTES,
  MIN_ROUTE_LENGTH_M,
  CANDIDATE_COUNT,
  DISTANCE_TOLERANCE_FRACTION,
  BBOX_DIAGONAL_MAX_FACTOR,
} from "@/lib/constants";
import { fetchCandidates, OrsRateLimitError, OrsEmptyRoutesError } from "@/lib/ors";
import { selectBestCandidate, hillinessLabel } from "@/lib/routeScoring";
import { computeFingerprint } from "@/lib/fingerprint";
import { getDemoRouteResult } from "@/lib/demo";

const VALID_HILLINESS: HillinessPreference[] = ["no_hill", "little_hill", "damon_hill"];

/** POST handler for generating a random walking route. */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body.", retryable: false } satisfies GenerateRouteResponse,
      { status: 400 }
    );
  }

  const req = body as Partial<RouteRequest>;

  if (typeof req.lat !== "number" || typeof req.lng !== "number") {
    return NextResponse.json(
      { ok: false, error: "lat and lng are required numbers.", retryable: false } satisfies GenerateRouteResponse,
      { status: 400 }
    );
  }

  if (typeof req.minutes !== "number" || isNaN(req.minutes)) {
    return NextResponse.json(
      { ok: false, error: "minutes is required and must be a number.", retryable: false } satisfies GenerateRouteResponse,
      { status: 400 }
    );
  }

  if (!req.hilliness || !VALID_HILLINESS.includes(req.hilliness)) {
    return NextResponse.json(
      { ok: false, error: "hilliness must be one of: no_hill, little_hill, damon_hill.", retryable: false } satisfies GenerateRouteResponse,
      { status: 400 }
    );
  }

  const { lat, lng, hilliness } = req;
  const minutes = Math.min(MAX_WALK_MINUTES, Math.max(MIN_WALK_MINUTES, req.minutes));
  const targetDistanceM = Math.max(minutes * 60 * DEFAULT_WALKING_SPEED_MPS, MIN_ROUTE_LENGTH_M);

  // Demo mode when no API key in development
  const apiKey = process.env.ORS_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[generate-route] ORS_API_KEY not set — returning demo fixture.");
      const result = getDemoRouteResult();
      result.targetDistanceM = targetDistanceM;
      return NextResponse.json({ ok: true, result } satisfies GenerateRouteResponse);
    }
    console.error("[generate-route] ORS_API_KEY is not configured.");
    return NextResponse.json(
      { ok: false, error: "Server configuration error.", retryable: false } satisfies GenerateRouteResponse,
      { status: 500 }
    );
  }

  // Generate seeds
  const lockedSeeds = new Set(req.lockedSeeds ?? []);
  const seeds: number[] = [];
  if (typeof req.seed === "number") {
    seeds.push(req.seed);
  }
  while (seeds.length < CANDIDATE_COUNT) {
    const s = Math.floor(Math.random() * 2147483647);
    if (!lockedSeeds.has(s) && !seeds.includes(s)) {
      seeds.push(s);
    }
  }

  try {
    const candidates = await fetchCandidates(apiKey, lng, lat, targetDistanceM, seeds, hilliness);

    // First pass: normal scoring
    let best = selectBestCandidate(candidates, hilliness, targetDistanceM, lat, lng);

    // Relaxed pass if all rejected
    if (!best) {
      const relaxedToleranceFraction = DISTANCE_TOLERANCE_FRACTION * 2;
      const relaxedBboxFactor = 3.0;

      // Re-score with relaxed constraints by temporarily modifying constants
      for (const c of candidates) {
        const tolerance = relaxedToleranceFraction * targetDistanceM;
        let distanceDeviation = 0;
        if (c.distanceM < targetDistanceM - tolerance || c.distanceM > targetDistanceM + tolerance) {
          distanceDeviation = (Math.abs(c.distanceM - targetDistanceM) / targetDistanceM) * 100;
        }

        const { haversineDistance } = await import("@/lib/geometry");
        const { bboxDiagonal } = await import("@/lib/geometry");
        const { HILLINESS_RANGES } = await import("@/lib/constants");

        const range = HILLINESS_RANGES[hilliness];
        const hillinessDeviation = Math.abs(c.ascentPerKm - range.midpoint);
        let score = hillinessDeviation + distanceDeviation;

        const coords = c.geometry.coordinates;
        const firstCoord = coords[0];
        const lastCoord = coords[coords.length - 1];
        const startDist = haversineDistance(lat, lng, firstCoord[1], firstCoord[0]);
        const endDist = haversineDistance(lat, lng, lastCoord[1], lastCoord[0]);
        if (startDist > 300 || endDist > 300) {
          score = Infinity;
        }

        const expectedRadius = targetDistanceM / (2 * Math.PI);
        const diagonal = bboxDiagonal(c.bbox);
        if (diagonal > relaxedBboxFactor * expectedRadius) {
          score = Infinity;
        }

        c.score = score;
      }

      const viable = candidates.filter((c) => c.score < Infinity);
      if (viable.length > 0) {
        viable.sort((a, b) => a.score - b.score);
        best = viable[0];
      }
    }

    if (!best) {
      return NextResponse.json(
        {
          ok: false,
          error: "Could not find a suitable route. Try adjusting your preferences or location.",
          retryable: true,
        } satisfies GenerateRouteResponse,
        { status: 200 }
      );
    }

    const fingerprint = computeFingerprint(best.geometry.coordinates);
    const result = {
      candidate: best,
      hillinessScore: hillinessLabel(best.ascentPerKm),
      targetDistanceM,
      fingerprint,
    };

    return NextResponse.json({ ok: true, result } satisfies GenerateRouteResponse);
  } catch (err) {
    if (err instanceof OrsRateLimitError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Rate limited. Please wait a moment and try again.",
          retryable: true,
        } satisfies GenerateRouteResponse,
        { status: 200 }
      );
    }

    if (err instanceof OrsEmptyRoutesError) {
      return NextResponse.json(
        {
          ok: false,
          error: "No walkable routes found near this location. Try a different starting point.",
          retryable: false,
        } satisfies GenerateRouteResponse,
        { status: 200 }
      );
    }

    console.error("[generate-route] Unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Routing service is temporarily unavailable.",
        retryable: true,
      } satisfies GenerateRouteResponse,
      { status: 200 }
    );
  }
}
