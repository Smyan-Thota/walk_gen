import { POST } from "@/app/api/generate-route/route";

// Mock ORS GeoJSON response
const mockOrsResponse = {
  type: "FeatureCollection",
  bbox: [-122.4194, 37.7749, 16, -122.4158, 37.7773, 30],
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-122.4194, 37.7749, 16],
          [-122.4189, 37.7755, 18],
          [-122.4180, 37.7762, 22],
          [-122.4170, 37.7768, 26],
          [-122.4158, 37.7773, 30],
          [-122.4194, 37.7749, 16],
        ],
      },
      properties: {
        summary: { distance: 2100, duration: 1600 },
        ascent: 45,
        descent: 43,
        segments: [
          {
            steps: [
              { instruction: "Head north", distance: 500, duration: 380 },
              { instruction: "Turn left", distance: 800, duration: 600 },
              { instruction: "Continue south", distance: 800, duration: 620 },
            ],
          },
        ],
      },
    },
  ],
};

// Store original env
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, ORS_API_KEY: "test-key", NODE_ENV: "test" };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockOrsResponse),
  }) as jest.Mock;
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

/** Helper to create a request with JSON body. */
function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/generate-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-route", () => {
  it("returns a valid route response", async () => {
    const req = makeRequest({
      lat: 37.7749,
      lng: -122.4194,
      minutes: 25,
      hilliness: "no_hill",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.result).toBeDefined();
    expect(data.result.candidate).toBeDefined();
    expect(data.result.candidate.distanceM).toBe(2100);
    expect(data.result.fingerprint).toBeDefined();
  });

  it("returns 400 for missing lat/lng", async () => {
    const req = makeRequest({ minutes: 25, hilliness: "no_hill" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("returns 400 for missing minutes", async () => {
    const req = makeRequest({ lat: 37.7749, lng: -122.4194, hilliness: "no_hill" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("returns 400 for invalid hilliness", async () => {
    const req = makeRequest({
      lat: 37.7749,
      lng: -122.4194,
      minutes: 25,
      hilliness: "invalid",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("returns retryable error when ORS fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const req = makeRequest({
      lat: 37.7749,
      lng: -122.4194,
      minutes: 25,
      hilliness: "no_hill",
    });

    const res = await POST(req);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.retryable).toBe(true);
  });

  it("returns demo fixture when no API key in development", async () => {
    process.env = { ...originalEnv, ORS_API_KEY: "", NODE_ENV: "development" };

    const req = makeRequest({
      lat: 37.7749,
      lng: -122.4194,
      minutes: 25,
      hilliness: "no_hill",
    });

    const res = await POST(req);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.result.candidate.seed).toBe(42); // demo seed
  });
});
