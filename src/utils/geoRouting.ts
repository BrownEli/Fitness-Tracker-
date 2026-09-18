import { JogPoint } from '../types';

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Calculates Haversine distance between two GPS coordinates in kilometers.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export interface RouteResult {
  distanceKm: number;
  coordinates: { lat: number; lng: number }[];
  durationSeconds?: number;
}

/**
 * Fetches walking/pedestrian street route between two points using OpenStreetMap's OSRM foot engine.
 * Returns actual sidewalk/street geometry and exact street distance in kilometers.
 */
export async function fetchPedestrianRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  timeoutMs = 6000
): Promise<RouteResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Note: OSRM expects longitude,latitude;longitude,latitude
    const url = `https://router.project-osrm.org/route/v1/foot/${start.lng.toFixed(6)},${start.lat.toFixed(6)};${end.lng.toFixed(6)},${end.lat.toFixed(6)}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) return null;
    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distKm = route.distance / 1000;
      const coords: { lat: number; lng: number }[] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({ lat, lng })
      );

      return {
        distanceKm: distKm,
        coordinates: coords,
        durationSeconds: route.duration
      };
    }
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Detects if a route contains long straight-line gaps (e.g. phone was asleep or in pocket)
 * where the distance between consecutive points exceeds the threshold (default 40m).
 */
export function detectStraightLineGaps(points: JogPoint[], gapThresholdKm = 0.04): boolean {
  if (!points || points.length < 2) return false;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const d = calculateHaversineDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);
    if (d >= gapThresholdKm) {
      return true;
    }
  }
  return false;
}

/**
 * Calculates the total cumulative distance of a route (in km).
 */
export function calculateRouteDistanceKm(points: JogPoint[]): number {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateHaversineDistanceKm(
      points[i].lat,
      points[i].lng,
      points[i + 1].lat,
      points[i + 1].lng
    );
  }
  return total;
}

/**
 * Reconstructs a full route by routing any long straight-line gaps along actual pedestrian sidewalks/streets.
 * Replaces straight line chords through buildings with street turns and recalculates the real walking distance.
 */
export async function snapRouteToPedestrianStreets(
  points: JogPoint[],
  gapThresholdKm = 0.04
): Promise<{
  snappedPoints: JogPoint[];
  totalDistanceKm: number;
  distanceDifferenceKm: number;
  snappedSegmentsCount: number;
}> {
  if (!points || points.length < 2) {
    return {
      snappedPoints: points || [],
      totalDistanceKm: 0,
      distanceDifferenceKm: 0,
      snappedSegmentsCount: 0
    };
  }

  const originalDistance = calculateRouteDistanceKm(points);
  const resultPoints: JogPoint[] = [points[0]];
  let totalDistance = 0;
  let snappedSegmentsCount = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const segmentStraightKm = calculateHaversineDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);

    // If gap is large (e.g. > 40 meters), attempt street routing
    if (segmentStraightKm >= gapThresholdKm) {
      const streetRoute = await fetchPedestrianRoute(p1, p2);
      if (streetRoute && streetRoute.coordinates.length > 1) {
        snappedSegmentsCount++;
        const intermediateCoords = streetRoute.coordinates.slice(1);
        const timeSpan = Math.max(1000, p2.timestamp - p1.timestamp);
        const stepTime = timeSpan / intermediateCoords.length;

        intermediateCoords.forEach((coord, idx) => {
          resultPoints.push({
            lat: coord.lat,
            lng: coord.lng,
            timestamp: Math.round(p1.timestamp + stepTime * (idx + 1))
          });
        });

        totalDistance += streetRoute.distanceKm;
        continue;
      }
    }

    // Normal small step or fallback if routing unavailable
    resultPoints.push(p2);
    totalDistance += segmentStraightKm;
  }

  const distanceDifferenceKm = Math.max(0, totalDistance - originalDistance);

  return {
    snappedPoints: resultPoints,
    totalDistanceKm: Number(totalDistance.toFixed(3)),
    distanceDifferenceKm: Number(distanceDifferenceKm.toFixed(3)),
    snappedSegmentsCount
  };
}
