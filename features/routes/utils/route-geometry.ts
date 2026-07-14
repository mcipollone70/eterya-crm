import type { GeoPoint } from "../types/visit-tour";
import { getDistanceKm } from "@/features/maps/utils/geo-distance";

function projectPointOnSegment(
  point: GeoPoint,
  start: GeoPoint,
  end: GeoPoint
): GeoPoint {
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;

  if (dx === 0 && dy === 0) {
    return start;
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) / (dx * dx + dy * dy)
    )
  );

  return {
    lat: start.lat + t * dy,
    lng: start.lng + t * dx,
  };
}

export function minDistanceToRouteKm(point: GeoPoint, route: GeoPoint[]): number {
  if (route.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (route.length === 1) {
    return getDistanceKm(point.lat, point.lng, route[0]!.lat, route[0]!.lng);
  }

  let minDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < route.length - 1; index += 1) {
    const start = route[index]!;
    const end = route[index + 1]!;
    const projected = projectPointOnSegment(point, start, end);
    const distance = getDistanceKm(point.lat, point.lng, projected.lat, projected.lng);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

export function geoJsonLineToPoints(coordinates: number[][]): GeoPoint[] {
  return coordinates.map(([lng, lat]) => ({ lat, lng }));
}
