import type { RouteResult } from "./types";

/** Hard-coded demo route near downtown San Francisco for development without API keys. */
export function getDemoRouteResult(): RouteResult {
  const coordinates: number[][] = [
    [-122.4194, 37.7749, 16],
    [-122.4189, 37.7755, 18],
    [-122.4180, 37.7762, 22],
    [-122.4170, 37.7768, 26],
    [-122.4158, 37.7773, 30],
    [-122.4145, 37.7778, 34],
    [-122.4132, 37.7782, 38],
    [-122.4120, 37.7785, 42],
    [-122.4108, 37.7780, 46],
    [-122.4098, 37.7773, 50],
    [-122.4090, 37.7765, 53],
    [-122.4085, 37.7755, 56],
    [-122.4082, 37.7745, 58],
    [-122.4080, 37.7735, 60],
    [-122.4083, 37.7725, 57],
    [-122.4088, 37.7716, 52],
    [-122.4095, 37.7708, 47],
    [-122.4105, 37.7702, 42],
    [-122.4116, 37.7698, 37],
    [-122.4128, 37.7696, 32],
    [-122.4140, 37.7698, 28],
    [-122.4152, 37.7702, 24],
    [-122.4162, 37.7708, 21],
    [-122.4170, 37.7716, 19],
    [-122.4176, 37.7725, 18],
    [-122.4180, 37.7733, 17],
    [-122.4184, 37.7738, 16],
    [-122.4188, 37.7743, 16],
    [-122.4192, 37.7746, 16],
    [-122.4194, 37.7749, 16],
  ];

  return {
    candidate: {
      seed: 42,
      distanceM: 2100,
      durationS: 1600,
      ascentM: 45,
      descentM: 43,
      ascentPerKm: 21.4,
      geometry: {
        type: "LineString",
        coordinates,
      },
      bbox: [-122.4194, 37.7696, -122.4080, 37.7785],
      steps: [
        { instruction: "Head north on Market Street", distanceM: 180, durationS: 135 },
        { instruction: "Turn left onto 5th Street", distanceM: 250, durationS: 190 },
        { instruction: "Turn right onto Mission Street", distanceM: 320, durationS: 240 },
        { instruction: "Continue onto Howard Street", distanceM: 280, durationS: 210 },
        { instruction: "Turn left onto 2nd Street", distanceM: 200, durationS: 150 },
        { instruction: "Turn right onto Folsom Street", distanceM: 310, durationS: 230 },
        { instruction: "Turn left onto 4th Street", distanceM: 260, durationS: 195 },
        { instruction: "Continue onto Market Street", distanceM: 180, durationS: 135 },
        { instruction: "Arrive at starting point", distanceM: 120, durationS: 115 },
      ],
      score: 3.9,
    },
    hillinessScore: "Rolling 🟡",
    targetDistanceM: 2010,
    fingerprint: "demo_fp_42",
  };
}
