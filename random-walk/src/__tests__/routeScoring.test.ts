import { scoreCandidate, selectBestCandidate, hillinessLabel } from "@/lib/routeScoring";
import type { RouteCandidate } from "@/lib/types";

/** Create a minimal test candidate. */
function makeCandidate(overrides: Partial<RouteCandidate> = {}): RouteCandidate {
  return {
    seed: 1,
    distanceM: 2000,
    durationS: 1500,
    ascentM: 10,
    descentM: 10,
    ascentPerKm: 5,
    geometry: {
      type: "LineString",
      coordinates: [
        [-122.4194, 37.7749, 10],
        [-122.4190, 37.7755, 12],
        [-122.4194, 37.7749, 10],
      ],
    },
    bbox: [-122.4200, 37.7745, -122.4188, 37.7755],
    steps: [],
    score: 0,
    ...overrides,
  };
}

const ORIGIN_LAT = 37.7749;
const ORIGIN_LNG = -122.4194;
const TARGET_DISTANCE = 2000;

describe("scoreCandidate", () => {
  it("scores a flat candidate lower than a hilly one for no_hill", () => {
    const flat = makeCandidate({ ascentPerKm: 5 });
    const hilly = makeCandidate({ ascentPerKm: 30 });
    const flatScore = scoreCandidate(flat, "no_hill", TARGET_DISTANCE, ORIGIN_LAT, ORIGIN_LNG);
    const hillyScore = scoreCandidate(hilly, "no_hill", TARGET_DISTANCE, ORIGIN_LAT, ORIGIN_LNG);
    expect(flatScore).toBeLessThan(hillyScore);
  });

  it("scores a hilly candidate well for damon_hill", () => {
    const c = makeCandidate({ ascentPerKm: 45 });
    const score = scoreCandidate(c, "damon_hill", TARGET_DISTANCE, ORIGIN_LAT, ORIGIN_LNG);
    expect(score).toBeLessThan(5);
  });

  it("penalizes distance outside tolerance", () => {
    const c = makeCandidate({ distanceM: 3000 });
    const score = scoreCandidate(c, "no_hill", TARGET_DISTANCE, ORIGIN_LAT, ORIGIN_LNG);
    expect(score).toBeGreaterThan(10);
  });

  it("rejects candidate with bbox too large", () => {
    const c = makeCandidate({
      bbox: [-123.0, 37.0, -122.0, 38.0], // very large bbox
    });
    const score = scoreCandidate(c, "no_hill", TARGET_DISTANCE, ORIGIN_LAT, ORIGIN_LNG);
    expect(score).toBe(Infinity);
  });

  it("rejects candidate where start/end is far from origin", () => {
    const c = makeCandidate({
      geometry: {
        type: "LineString",
        coordinates: [
          [-121.0, 36.0, 10], // far from origin
          [-121.0, 36.001, 12],
          [-121.0, 36.0, 10], // far from origin
        ],
      },
    });
    const score = scoreCandidate(c, "no_hill", TARGET_DISTANCE, ORIGIN_LAT, ORIGIN_LNG);
    expect(score).toBe(Infinity);
  });
});

describe("selectBestCandidate", () => {
  it("returns the lowest-scored candidate", () => {
    const c1 = makeCandidate({ seed: 1, ascentPerKm: 5 });
    const c2 = makeCandidate({ seed: 2, ascentPerKm: 30 }); // worse for no_hill
    const best = selectBestCandidate([c1, c2], "no_hill", TARGET_DISTANCE, ORIGIN_LAT, ORIGIN_LNG);
    expect(best).not.toBeNull();
    expect(best!.seed).toBe(1);
  });

  it("returns null if all candidates are rejected", () => {
    const c1 = makeCandidate({
      seed: 1,
      geometry: {
        type: "LineString",
        coordinates: [
          [-121.0, 36.0, 10],
          [-121.0, 36.001, 12],
          [-121.0, 36.0, 10],
        ],
      },
    });
    const best = selectBestCandidate([c1], "no_hill", TARGET_DISTANCE, ORIGIN_LAT, ORIGIN_LNG);
    expect(best).toBeNull();
  });
});

describe("hillinessLabel", () => {
  it("returns Flat for low ascent", () => {
    expect(hillinessLabel(5)).toContain("Flat");
  });

  it("returns Very Hilly for high ascent", () => {
    expect(hillinessLabel(50)).toContain("Very Hilly");
  });
});
