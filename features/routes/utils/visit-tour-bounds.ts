import type { GeoPoint, VisitTourGeoBounds } from "../types/visit-tour";
import { VISIT_TOUR_BOUNDS_PADDING_RATIO } from "../constants/visit-tour-fetch";

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function expandBounds(
  bounds: VisitTourGeoBounds,
  paddingRatio = VISIT_TOUR_BOUNDS_PADDING_RATIO
): VisitTourGeoBounds {
  const latSpan = bounds.north - bounds.south;
  const lngSpan = bounds.east - bounds.west;
  const latPad = latSpan * paddingRatio;
  const lngPad = lngSpan * paddingRatio;

  return {
    north: Math.min(90, bounds.north + latPad),
    south: Math.max(-90, bounds.south - latPad),
    east: Math.min(180, bounds.east + lngPad),
    west: Math.max(-180, bounds.west - lngPad),
  };
}

export function boundsFromCenter(center: GeoPoint, radiusKm: number): VisitTourGeoBounds {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(0.2, Math.cos(toRadians(center.lat))));

  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}

export function boundsFromPoints(points: GeoPoint[], bufferKm: number): VisitTourGeoBounds | null {
  if (points.length === 0) {
    return null;
  }

  let north = points[0]!.lat;
  let south = points[0]!.lat;
  let east = points[0]!.lng;
  let west = points[0]!.lng;

  for (const point of points) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }

  const centerLat = (north + south) / 2;
  const latBuffer = bufferKm / 111;
  const lngBuffer = bufferKm / (111 * Math.max(0.2, Math.cos(toRadians(centerLat))));

  return {
    north: north + latBuffer,
    south: south - latBuffer,
    east: east + lngBuffer,
    west: west - lngBuffer,
  };
}

export function boundsKey(bounds: VisitTourGeoBounds): string {
  return [
    bounds.north.toFixed(3),
    bounds.south.toFixed(3),
    bounds.east.toFixed(3),
    bounds.west.toFixed(3),
  ].join(":");
}

export function approxRadiusKmFromBounds(bounds: VisitTourGeoBounds): number {
  const centerLat = (bounds.north + bounds.south) / 2;
  const latKm = (bounds.north - bounds.south) * 111;
  const lngKm =
    (bounds.east - bounds.west) *
    111 *
    Math.max(0.2, Math.cos(toRadians(centerLat)));
  return Math.max(latKm, lngKm) / 2;
}
