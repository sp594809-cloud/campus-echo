import { db, campusesTable, type CampusHub } from "@workspace/db";

export const DEFAULT_GEOFENCE_RADIUS_KM = 2;

export function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadiusKm = 6371.0088;
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
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine))
  );
}

export async function findNearestHub(
  latitude: number,
  longitude: number,
): Promise<{ hub: CampusHub; distanceKm: number; withinRadius: boolean } | null> {
  const hubs = await db.select().from(campusesTable);
  let nearest: { hub: CampusHub; distanceKm: number } | null = null;

  for (const hub of hubs) {
    const distanceKm = haversineDistanceKm(
      latitude,
      longitude,
      hub.latitude,
      hub.longitude,
    );
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { hub, distanceKm };
    }
  }

  if (!nearest) return null;
  return {
    ...nearest,
    distanceKm: Number(nearest.distanceKm.toFixed(2)),
    withinRadius: nearest.distanceKm <= nearest.hub.radiusKm,
  };
}

export function isInsideHub(
  nearest: { hub: CampusHub; distanceKm: number; withinRadius: boolean } | null,
  expectedHubId?: number,
): nearest is { hub: CampusHub; distanceKm: number; withinRadius: true } {
  return Boolean(
    nearest?.withinRadius &&
      (expectedHubId === undefined || nearest.hub.id === expectedHubId),
  );
}

export function geofenceErrorPayload(
  nearest: Awaited<ReturnType<typeof findNearestHub>>,
) {
  return {
    error: "Campus Echo is available within 2 km of a campus hub.",
    distanceKm: nearest?.distanceKm,
    radiusKm: nearest?.hub.radiusKm ?? DEFAULT_GEOFENCE_RADIUS_KM,
  };
}