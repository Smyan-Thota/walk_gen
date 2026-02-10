import type { HillinessPreference, RouteCandidate } from "./types";
import {
  HILLINESS_RANGES,
  DISTANCE_TOLERANCE_FRACTION,
  START_END_MAX_DISTANCE_M,
  BBOX_DIAGONAL_MAX_FACTOR,
} from "./constants";
import { haversineDistance, bboxDiagonal } from "./geometry";

/** Score a single route candidate against the user's preferences. */
export function scoreCandidate(
  candidate: RouteCandidate,
  hilliness: HillinessPreference,
  targetDistanceM: number,
  originLat: number,
  originLng: number
): number {
  let distanceDeviation = 0;
  const tolerance = DISTANCE_TOLERANCE_FRACTION * targetDistanceM;
  if (
    candidate.distanceM < targetDistanceM - tolerance ||
    candidate.distanceM > targetDistanceM + tolerance
  ) {
    distanceDeviation = (Math.abs(candidate.distanceM - targetDistanceM) / targetDistanceM) * 100;
  }

  let score: number;

  if (hilliness === "no_hill") {
    // For flat preference: minimize total ascent directly.
    // Ascent is the dominant factor (10x weight), distance deviation is a tiebreaker.
    score = candidate.ascentPerKm * 10 + distanceDeviation;
  } else if (hilliness === "damon_hill") {
    // For max hills: reward higher ascent, penalize low ascent.
    // Use inverse: lower ascentPerKm = higher score (worse).
    const range = HILLINESS_RANGES[hilliness];
    const hillinessDeviation = Math.abs(candidate.ascentPerKm - range.midpoint);
    score = hillinessDeviation + distanceDeviation;
  } else {
    // For moderate hills: score against midpoint as before.
    const range = HILLINESS_RANGES[hilliness];
    const hillinessDeviation = Math.abs(candidate.ascentPerKm - range.midpoint);
    score = hillinessDeviation + distanceDeviation;
  }

  // Rejection: start/end too far from origin
  const coords = candidate.geometry.coordinates;
  const firstCoord = coords[0];
  const lastCoord = coords[coords.length - 1];
  const startDist = haversineDistance(originLat, originLng, firstCoord[1], firstCoord[0]);
  const endDist = haversineDistance(originLat, originLng, lastCoord[1], lastCoord[0]);
  if (startDist > START_END_MAX_DISTANCE_M || endDist > START_END_MAX_DISTANCE_M) {
    score = Infinity;
  }

  // Rejection: bbox too large
  const expectedRadius = targetDistanceM / (2 * Math.PI);
  const diagonal = bboxDiagonal(candidate.bbox);
  if (diagonal > BBOX_DIAGONAL_MAX_FACTOR * expectedRadius) {
    score = Infinity;
  }

  return score;
}

/** Select the best candidate from an array, returning null if none are viable. */
export function selectBestCandidate(
  candidates: RouteCandidate[],
  hilliness: HillinessPreference,
  targetDistanceM: number,
  originLat: number,
  originLng: number
): RouteCandidate | null {
  let best: RouteCandidate | null = null;
  let bestScore = Infinity;

  for (const c of candidates) {
    const score = scoreCandidate(c, hilliness, targetDistanceM, originLat, originLng);
    c.score = score;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (bestScore === Infinity) return null;
  return best;
}

/** Derive a human-friendly hilliness label from ascent per km. */
export function hillinessLabel(ascentPerKm: number): string {
  if (ascentPerKm <= 10) return "Flat 🟢";
  if (ascentPerKm <= 25) return "Rolling 🟡";
  if (ascentPerKm <= 40) return "Hilly 🟠";
  return "Very Hilly 🔴";
}
