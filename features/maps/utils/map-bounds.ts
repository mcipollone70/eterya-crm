import {
  MAP_BOUNDS_MAX_SUBDIVIDE_DEPTH,
  MAP_BOUNDS_MIN_SPAN_DEGREES,
  MAP_BOUNDS_PADDING_RATIO,
  MAP_INITIAL_RADIUS_KM,
} from "../constants/map-config";
import type { MapGeoBounds, MapViewportState } from "../types/map";

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function expandBounds(
  bounds: MapGeoBounds,
  paddingRatio = MAP_BOUNDS_PADDING_RATIO
): MapGeoBounds {
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

export function boundsFromCenter(
  center: { lat: number; lng: number },
  radiusKm = MAP_INITIAL_RADIUS_KM
): MapGeoBounds {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(0.2, Math.cos(toRadians(center.lat))));

  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}

export function boundsFromViewport(viewport: MapViewportState): MapGeoBounds {
  return boundsFromCenter({ lat: viewport.lat, lng: viewport.lng });
}

export function boundsKey(bounds: MapGeoBounds): string {
  return [
    bounds.north.toFixed(3),
    bounds.south.toFixed(3),
    bounds.east.toFixed(3),
    bounds.west.toFixed(3),
  ].join(":");
}

export function filtersKey(filters: {
  commercialStatus: string;
  province: string;
  city: string;
  geolocatedOnly: boolean;
}): string {
  return [
    filters.commercialStatus,
    filters.province,
    filters.city,
    filters.geolocatedOnly ? "1" : "0",
  ].join("|");
}

export function boundsRequestKey(
  bounds: MapGeoBounds,
  filters: {
    commercialStatus: string;
    province: string;
    city: string;
    geolocatedOnly: boolean;
  }
): string {
  return `${boundsKey(bounds)}::${filtersKey(filters)}`;
}

export function boundsSpan(bounds: MapGeoBounds): { lat: number; lng: number } {
  return {
    lat: bounds.north - bounds.south,
    lng: bounds.east - bounds.west,
  };
}

export function canSubdivideBounds(bounds: MapGeoBounds, depth: number): boolean {
  if (depth >= MAP_BOUNDS_MAX_SUBDIVIDE_DEPTH) {
    return false;
  }

  const span = boundsSpan(bounds);
  return span.lat > MAP_BOUNDS_MIN_SPAN_DEGREES && span.lng > MAP_BOUNDS_MIN_SPAN_DEGREES;
}

export function subdivideBounds(bounds: MapGeoBounds): MapGeoBounds[] {
  const midLat = (bounds.north + bounds.south) / 2;
  const midLng = (bounds.east + bounds.west) / 2;

  return [
    { north: bounds.north, south: midLat, east: midLng, west: bounds.west },
    { north: bounds.north, south: midLat, east: bounds.east, west: midLng },
    { north: midLat, south: bounds.south, east: midLng, west: bounds.west },
    { north: midLat, south: bounds.south, east: bounds.east, west: midLng },
  ];
}
