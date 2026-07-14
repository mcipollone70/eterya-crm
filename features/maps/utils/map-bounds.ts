import {
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
