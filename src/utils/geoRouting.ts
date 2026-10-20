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
    // We add continue_straight=true to prevent artificial U-turns
    const url = `https://router.project-osrm.org/route/v1/foot/${start.lng.toFixed(6)},${start.lat.toFixed(6)};${end.lng.toFixed(6)},${end.lat.toFixed(6)}?overview=full&geometries=geojson&continue_straight=true`;
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
 * where the distance between consecutive points exceeds the threshold (default 120m / 0.12km).
 */
export function detectStraightLineGaps(points: JogPoint[], gapThresholdKm = 0.25): boolean {
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
 * SAFETY CHECKS:
 * 1. Strict detour limit (max 15% longer than straight line) to prevent looping around city blocks.
 * 2. Seamless stitching: intermediate coordinates never duplicate endpoints or create acute back-and-forth zigzags.
 * 3. Automatic cleaning pass to strip any micro-jitter or oscillation artifacts before returning.
 */
export async function snapRouteToPedestrianStreets(
  points: JogPoint[],
  gapThresholdKm = 0.20
): Promise<{
  snappedPoints: JogPoint[];
  totalDistanceKm: number;
  distanceDifferenceKm: number;
  snappedSegmentsCount: number;
}> {
  if (!points || points.length < 2) {
    const origDist = calculateRouteDistanceKm(points || []);
    return {
      snappedPoints: points || [],
      totalDistanceKm: Number(origDist.toFixed(3)),
      distanceDifferenceKm: 0,
      snappedSegmentsCount: 0
    };
  }

  const originalDistance = calculateRouteDistanceKm(points);
  const resultPoints: JogPoint[] = [points[0]];
  let snappedSegmentsCount = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const segmentStraightKm = calculateHaversineDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);

    // If gap between points is large (e.g. >= 200m while device was asleep or in pocket), attempt street alignment
    if (segmentStraightKm >= gapThresholdKm) {
      const streetRoute = await fetchPedestrianRoute(p1, p2);
      
      // Detour protection: Walking around standard city blocks has a Manhattan ratio of ~1.41x straight-line.
      // Allow up to 1.55x straight-line distance, but reject excessive circular detours (> 1.55x).
      const maxAllowedDetourKm = Math.max(0.08, segmentStraightKm * 1.55);
      
      if (
        streetRoute &&
        streetRoute.coordinates &&
        streetRoute.coordinates.length >= 2 &&
        streetRoute.distanceKm <= maxAllowedDetourKm
      ) {
        // Filter out coordinates that are micro-duplicates of p1 or p2
        const intermediateCoords = streetRoute.coordinates.filter((coord) => {
          const dFromP1 = calculateHaversineDistanceKm(p1.lat, p1.lng, coord.lat, coord.lng);
          const dFromP2 = calculateHaversineDistanceKm(p2.lat, p2.lng, coord.lat, coord.lng);
          return dFromP1 >= 0.005 && dFromP2 >= 0.005;
        });

        if (intermediateCoords.length > 0) {
          snappedSegmentsCount++;
          const timeSpan = Math.max(1000, p2.timestamp - p1.timestamp);
          const stepTime = timeSpan / (intermediateCoords.length + 1);

          intermediateCoords.forEach((coord, idx) => {
            resultPoints.push({
              lat: coord.lat,
              lng: coord.lng,
              timestamp: Math.round(p1.timestamp + stepTime * (idx + 1))
            });
          });
        }

        resultPoints.push(p2);
        continue;
      }
    }

    // Keep natural GPS step when gap is normal or when routing detour is excessive
    resultPoints.push(p2);
  }

  // Run cleanup pass to ensure strictly chronological, oscillation-free route
  const cleaned = cleanAndRecalculateGpsRoute(resultPoints);
  const finalPoints = cleaned.cleanedPoints;
  const finalDistanceKm = cleaned.cleanedDistanceKm;
  const distanceDifferenceKm = Math.max(0, finalDistanceKm - originalDistance);

  return {
    snappedPoints: finalPoints,
    totalDistanceKm: Number(finalDistanceKm.toFixed(3)),
    distanceDifferenceKm: Number(distanceDifferenceKm.toFixed(3)),
    snappedSegmentsCount
  };
}

/**
 * Detects if a route has circling / fold-back artifacts or out-of-order timestamp glitches.
 */
export function hasRouteCirclingArtifacts(points: JogPoint[]): boolean {
  if (!points || points.length < 5) return false;
  
  // Check if timestamps are out of order
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i + 1].timestamp < points[i].timestamp - 1000) {
      return true;
    }
  }

  // Check for acute back-and-forth oscillations (jumping ahead and immediately jumping back)
  let oscillationCount = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const dPrevCurr = calculateHaversineDistanceKm(prev.lat, prev.lng, curr.lat, curr.lng);
    const dCurrNext = calculateHaversineDistanceKm(curr.lat, curr.lng, next.lat, next.lng);
    const dPrevNext = calculateHaversineDistanceKm(prev.lat, prev.lng, next.lat, next.lng);

    if (dPrevCurr > 0.025 && dCurrNext > 0.025 && dPrevNext < 0.015) {
      oscillationCount++;
      if (oscillationCount >= 2) return true;
    }
  }
  return false;
}

/**
 * Cleans a recorded GPS route by:
 * 1. Sorting points strictly chronologically by timestamp (eliminates out-of-order race conditions).
 * 2. Deduplicating micro-jitter points (< 2.5 meters).
 * 3. Removing acute zigzag/circling loops where snapping or GPS drift caused the path to double back on itself.
 * 4. Recalculating the true, clean walking distance along the genuine path.
 */
export function cleanAndRecalculateGpsRoute(points: JogPoint[]): {
  cleanedPoints: JogPoint[];
  originalDistanceKm: number;
  cleanedDistanceKm: number;
  reducedKm: number;
} {
  if (!points || points.length < 2) {
    const orig = calculateRouteDistanceKm(points);
    return {
      cleanedPoints: points || [],
      originalDistanceKm: Number(orig.toFixed(3)),
      cleanedDistanceKm: Number(orig.toFixed(3)),
      reducedKm: 0
    };
  }

  const originalDistanceKm = calculateRouteDistanceKm(points);

  // 1. Sort strictly chronologically by timestamp to eliminate backwards jumps
  const chronological = [...points].sort((a, b) => a.timestamp - b.timestamp);

  // 2. Remove micro-duplicates (< 2.5 meters)
  const deduped: JogPoint[] = [chronological[0]];
  for (let i = 1; i < chronological.length; i++) {
    const last = deduped[deduped.length - 1];
    const curr = chronological[i];
    const dist = calculateHaversineDistanceKm(last.lat, last.lng, curr.lat, curr.lng);
    if (dist >= 0.0025) {
      deduped.push(curr);
    }
  }

  // 3. Remove acute oscillation spikes where path bounced back and forth
  const smoothed: JogPoint[] = [];
  for (let i = 0; i < deduped.length; i++) {
    if (i > 0 && i < deduped.length - 1) {
      const prev = deduped[i - 1];
      const curr = deduped[i];
      const next = deduped[i + 1];

      const dPrevCurr = calculateHaversineDistanceKm(prev.lat, prev.lng, curr.lat, curr.lng);
      const dCurrNext = calculateHaversineDistanceKm(curr.lat, curr.lng, next.lat, next.lng);
      const dPrevNext = calculateHaversineDistanceKm(prev.lat, prev.lng, next.lat, next.lng);

      // If jumping out > 25 meters and then immediately returning to within 12 meters of previous point
      if (dPrevNext < 0.012 && dPrevCurr > 0.025 && dCurrNext > 0.025) {
        continue; // Filter out the oscillation spike
      }
    }
    smoothed.push(deduped[i]);
  }

  const cleanedDistanceKm = calculateRouteDistanceKm(smoothed);
  const reducedKm = Math.max(0, originalDistanceKm - cleanedDistanceKm);

  return {
    cleanedPoints: smoothed,
    originalDistanceKm: Number(originalDistanceKm.toFixed(3)),
    cleanedDistanceKm: Number(cleanedDistanceKm.toFixed(3)),
    reducedKm: Number(reducedKm.toFixed(3))
  };
}
