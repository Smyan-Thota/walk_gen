import { computeFingerprint } from "@/lib/fingerprint";

describe("computeFingerprint", () => {
  const coordsA = [
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
  ];

  const coordsB = [
    [-122.4294, 37.7849, 16],
    [-122.4289, 37.7855, 18],
    [-122.4280, 37.7862, 22],
    [-122.4270, 37.7868, 26],
    [-122.4258, 37.7873, 30],
    [-122.4245, 37.7878, 34],
    [-122.4232, 37.7882, 38],
    [-122.4220, 37.7885, 42],
    [-122.4208, 37.7880, 46],
    [-122.4198, 37.7873, 50],
  ];

  it("returns a consistent hash for the same coordinates", () => {
    const fp1 = computeFingerprint(coordsA);
    const fp2 = computeFingerprint(coordsA);
    expect(fp1).toBe(fp2);
  });

  it("returns different hashes for different coordinates", () => {
    const fpA = computeFingerprint(coordsA);
    const fpB = computeFingerprint(coordsB);
    expect(fpA).not.toBe(fpB);
  });

  it("returns a non-empty string", () => {
    const fp = computeFingerprint(coordsA);
    expect(fp.length).toBeGreaterThan(0);
  });
});
