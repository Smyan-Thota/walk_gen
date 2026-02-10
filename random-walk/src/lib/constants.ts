/** Average walking speed in meters per second (~4.8 km/h). */
export const DEFAULT_WALKING_SPEED_MPS = 1.34;

/** Minimum allowed walk duration in minutes. */
export const MIN_WALK_MINUTES = 5;

/** Maximum allowed walk duration in minutes. */
export const MAX_WALK_MINUTES = 180;

/** Minimum target route length in meters. */
export const MIN_ROUTE_LENGTH_M = 400;

/** Number of ORS candidate routes to request concurrently. */
export const CANDIDATE_COUNT = 12;

/** Maximum number of fingerprints stored in localStorage. */
export const MAX_FINGERPRINT_HISTORY = 10;

/** Timeout per ORS request in milliseconds. */
export const ORS_TIMEOUT_MS = 4000;

/** Maximum retries per ORS candidate request. */
export const ORS_MAX_RETRIES = 2;

/** Acceptable distance deviation as a fraction of target distance. */
export const DISTANCE_TOLERANCE_FRACTION = 0.12;

/** Maximum distance between route start/end and origin in meters. */
export const START_END_MAX_DISTANCE_M = 150;

/** Maximum bbox diagonal as a factor of the expected radius. */
export const BBOX_DIAGONAL_MAX_FACTOR = 2.2;

/** Hilliness ranges keyed by preference, in meters of ascent per km. */
export const HILLINESS_RANGES: Record<string, { min: number; max: number; midpoint: number }> = {
  no_hill: { min: 0, max: 10, midpoint: 5 },
  little_hill: { min: 10, max: 25, midpoint: 17.5 },
  damon_hill: { min: 25, max: 80, midpoint: 45 },
};
