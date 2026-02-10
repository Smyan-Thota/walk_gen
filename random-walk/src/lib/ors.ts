import type { HillinessPreference, RouteCandidate, RouteStep } from "./types";
import { ORS_TIMEOUT_MS, ORS_MAX_RETRIES } from "./constants";
import { computeAscentDescent } from "./geometry";

const ORS_BASE_URL = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

/** Shape of a feature in the ORS GeoJSON response. */
interface OrsFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
  properties: {
    summary: {
      distance: number;
      duration: number;
    };
    ascent?: number;
    descent?: number;
    segments: {
      steps: {
        instruction: string;
        distance: number;
        duration: number;
      }[];
    }[];
  };
}

/** Shape of the ORS GeoJSON directions response. */
interface OrsGeoJsonResponse {
  type: "FeatureCollection";
  bbox: number[];
  features: OrsFeature[];
}

/** Fetch a single round-trip route candidate from ORS. */
async function fetchSingleCandidate(
  apiKey: string,
  lng: number,
  lat: number,
  targetDistanceM: number,
  seed: number,
  hilliness: HillinessPreference
): Promise<RouteCandidate> {
  const points = Math.min(8, Math.max(3, Math.round(targetDistanceM / 500)));

  const options: Record<string, unknown> = {
    round_trip: {
      length: targetDistanceM,
      points,
      seed,
    },
  };

  // For flat routes, avoid steps/stairs and penalize steep segments
  if (hilliness === "no_hill") {
    options.avoid_features = ["steps"];
    options.profile_params = { weightings: { steepness_difficulty: -2 } };
  } else if (hilliness === "little_hill") {
    options.avoid_features = ["steps"];
  }

  const body = {
    coordinates: [[lng, lat]],
    options,
    elevation: true,
    instructions: true,
    instructions_format: "text",
    units: "m",
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= ORS_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = attempt === 1 ? 500 : 1500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ORS_TIMEOUT_MS);

    try {
      const res = await fetch(ORS_BASE_URL, {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 429) {
        throw new OrsRateLimitError("Rate limited by ORS");
      }

      if (res.status >= 500) {
        throw new Error(`ORS returned ${res.status}`);
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ORS error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as OrsGeoJsonResponse;
      if (!data.features || data.features.length === 0) {
        throw new OrsEmptyRoutesError("ORS returned no routes");
      }

      const feature = data.features[0];
      const coords = feature.geometry.coordinates;
      const props = feature.properties;

      let ascentM = props.ascent ?? 0;
      let descentM = props.descent ?? 0;
      if (ascentM === 0 && descentM === 0) {
        const computed = computeAscentDescent(coords);
        ascentM = computed.ascentM;
        descentM = computed.descentM;
      }

      const distanceM = props.summary.distance;
      const steps: RouteStep[] = props.segments.flatMap((seg) =>
        seg.steps.map((s) => ({
          instruction: s.instruction,
          distanceM: s.distance,
          durationS: s.duration,
        }))
      );

      const bbox: [number, number, number, number] = [
        data.bbox[0],
        data.bbox[1],
        data.bbox[3],
        data.bbox[4],
      ];

      return {
        seed,
        distanceM,
        durationS: props.summary.duration,
        ascentM,
        descentM,
        ascentPerKm: ascentM / Math.max(distanceM / 1000, 0.1),
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
        bbox,
        steps,
        score: 0,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof OrsRateLimitError) throw err;
      if (err instanceof OrsEmptyRoutesError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("ORS request failed");
}

/** Fetch multiple route candidates concurrently from ORS. */
export async function fetchCandidates(
  apiKey: string,
  lng: number,
  lat: number,
  targetDistanceM: number,
  seeds: number[],
  hilliness: HillinessPreference
): Promise<RouteCandidate[]> {
  const results = await Promise.allSettled(
    seeds.map((seed) => fetchSingleCandidate(apiKey, lng, lat, targetDistanceM, seed, hilliness))
  );

  const candidates: RouteCandidate[] = [];
  let rateLimited = false;
  let emptyRoutes = false;

  for (const result of results) {
    if (result.status === "fulfilled") {
      candidates.push(result.value);
    } else {
      if (result.reason instanceof OrsRateLimitError) rateLimited = true;
      if (result.reason instanceof OrsEmptyRoutesError) emptyRoutes = true;
    }
  }

  if (candidates.length === 0) {
    if (rateLimited) {
      throw new OrsRateLimitError("Rate limited. Please wait a moment and try again.");
    }
    if (emptyRoutes) {
      throw new OrsEmptyRoutesError(
        "No walkable routes found near this location. Try a different starting point."
      );
    }
    throw new Error("Routing service is temporarily unavailable.");
  }

  return candidates;
}

/** Thrown when ORS returns 429. */
export class OrsRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrsRateLimitError";
  }
}

/** Thrown when ORS returns an empty routes array. */
export class OrsEmptyRoutesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrsEmptyRoutesError";
  }
}
