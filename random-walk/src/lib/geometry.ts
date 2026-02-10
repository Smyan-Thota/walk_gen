const EARTH_RADIUS_M = 6_371_000;

/** Convert degrees to radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Compute the haversine distance between two points in meters. */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/** Compute the diagonal distance of a bounding box in meters. */
export function bboxDiagonal(bbox: [number, number, number, number]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return haversineDistance(minLat, minLon, maxLat, maxLon);
}

/** Compute total ascent and descent from 3D coordinates (lon, lat, elevation). */
export function computeAscentDescent(coords: number[][]): { ascentM: number; descentM: number } {
  let ascentM = 0;
  let descentM = 0;

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    if (prev.length < 3 || curr.length < 3) continue;
    const delta = curr[2] - prev[2];
    if (delta > 0) {
      ascentM += delta;
    } else {
      descentM += Math.abs(delta);
    }
  }

  return { ascentM, descentM };
}
