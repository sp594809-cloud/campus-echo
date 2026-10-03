export const RADAR_RADIUS_METERS = 100;
export const RADAR_MAX_ACCURACY_METERS = 75;

const DIRECTION_SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type RadarDirection = (typeof DIRECTION_SECTORS)[number];
export type RadarDistanceBand = "0-25m" | "26-50m" | "51-75m" | "76-100m";

export function roundRadarCoordinate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function haversineDistanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));
  return (
    6_371_008.8 *
    2 *
    Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine))
  );
}

function bearingDegrees(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const phiA = radians(latitudeA);
  const phiB = radians(latitudeB);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const y = Math.sin(longitudeDelta) * Math.cos(phiB);
  const x =
    Math.cos(phiA) * Math.sin(phiB) -
    Math.sin(phiA) * Math.cos(phiB) * Math.cos(longitudeDelta);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function coarseRadarLocation(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): { direction: RadarDirection; distanceBand: RadarDistanceBand } | null {
  const distance = haversineDistanceMeters(
    latitudeA,
    longitudeA,
    latitudeB,
    longitudeB,
  );
  if (distance > RADAR_RADIUS_METERS) return null;

  const band: RadarDistanceBand =
    distance <= 25
      ? "0-25m"
      : distance <= 50
        ? "26-50m"
        : distance <= 75
          ? "51-75m"
          : "76-100m";
  const sectorIndex = Math.round(
    bearingDegrees(latitudeA, longitudeA, latitudeB, longitudeB) / 45,
  ) % DIRECTION_SECTORS.length;

  return { direction: DIRECTION_SECTORS[sectorIndex]!, distanceBand: band };
}