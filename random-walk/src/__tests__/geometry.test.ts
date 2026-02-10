import { haversineDistance, bboxDiagonal, computeAscentDescent } from "@/lib/geometry";

describe("haversineDistance", () => {
  it("computes London to Paris distance (~343.5 km)", () => {
    const dist = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(340_000);
    expect(dist).toBeLessThan(347_000);
  });

  it("returns 0 for identical points", () => {
    const dist = haversineDistance(37.7749, -122.4194, 37.7749, -122.4194);
    expect(dist).toBeCloseTo(0, 1);
  });

  it("computes a short distance correctly", () => {
    // ~111 m for 0.001 degrees of latitude
    const dist = haversineDistance(37.7749, -122.4194, 37.7759, -122.4194);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });
});

describe("bboxDiagonal", () => {
  it("computes diagonal of a small bbox in meters", () => {
    const bbox: [number, number, number, number] = [-122.42, 37.77, -122.41, 37.78];
    const diag = bboxDiagonal(bbox);
    expect(diag).toBeGreaterThan(1000);
    expect(diag).toBeLessThan(2000);
  });

  it("returns 0 for a zero-sized bbox", () => {
    const bbox: [number, number, number, number] = [-122.42, 37.77, -122.42, 37.77];
    const diag = bboxDiagonal(bbox);
    expect(diag).toBeCloseTo(0, 1);
  });
});

describe("computeAscentDescent", () => {
  it("sums positive and negative elevation changes", () => {
    const coords = [
      [0, 0, 100],
      [0, 0, 120],
      [0, 0, 110],
      [0, 0, 130],
      [0, 0, 125],
    ];
    const { ascentM, descentM } = computeAscentDescent(coords);
    expect(ascentM).toBe(40); // +20 + +20
    expect(descentM).toBe(15); // -10 + -5
  });

  it("handles flat elevation", () => {
    const coords = [
      [0, 0, 50],
      [0, 0, 50],
      [0, 0, 50],
    ];
    const { ascentM, descentM } = computeAscentDescent(coords);
    expect(ascentM).toBe(0);
    expect(descentM).toBe(0);
  });

  it("skips coordinates without elevation", () => {
    const coords = [
      [0, 0],
      [0, 0, 100],
      [0, 0],
    ];
    const { ascentM, descentM } = computeAscentDescent(coords);
    expect(ascentM).toBe(0);
    expect(descentM).toBe(0);
  });
});
