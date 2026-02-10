import { MAX_FINGERPRINT_HISTORY } from "./constants";

/** Compute a djb2 hash of a string. */
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/** Compute a fingerprint string for a route geometry. */
export function computeFingerprint(coordinates: number[][]): string {
  const sampled: number[][] = [];
  for (let i = 0; i < coordinates.length; i += 5) {
    const coord = coordinates[i];
    sampled.push([
      Math.round(coord[0] * 10000) / 10000,
      Math.round(coord[1] * 10000) / 10000,
    ]);
  }
  return djb2(JSON.stringify(sampled));
}

const STORAGE_KEY = "rw_fingerprints";

/** Get stored fingerprints from localStorage. */
export function getStoredFingerprints(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** Check if a fingerprint is already stored. */
export function isDuplicate(fingerprint: string): boolean {
  return getStoredFingerprints().includes(fingerprint);
}

/** Store a new fingerprint, evicting the oldest if at capacity. */
export function storeFingerprint(fingerprint: string): void {
  if (typeof window === "undefined") return;
  try {
    const fps = getStoredFingerprints();
    fps.push(fingerprint);
    while (fps.length > MAX_FINGERPRINT_HISTORY) {
      fps.shift();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fps));
  } catch {
    // localStorage may be unavailable
  }
}
