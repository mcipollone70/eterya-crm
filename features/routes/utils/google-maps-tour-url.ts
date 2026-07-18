import type { GeoPoint } from "../types/visit-tour";

/** Google Maps URL supporta al massimo ~10 tappe intermedie. */
export const GOOGLE_MAPS_MAX_WAYPOINTS = 10;

export function isValidGeoPoint(point: GeoPoint | null | undefined): point is GeoPoint {
  if (!point) {
    return false;
  }
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

function formatPoint(point: GeoPoint): string {
  return `${point.lat},${point.lng}`;
}

export interface GoogleMapsTourUrlResult {
  url: string;
  waypointCount: number;
  truncated: boolean;
  warning: string | null;
}

/** Navigazione verso una singola destinazione (tappa). */
export function buildGoogleMapsDestinationUrl(destination: GeoPoint): string {
  if (!isValidGeoPoint(destination)) {
    throw new Error("Coordinate destinazione non valide per Google Maps.");
  }

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", formatPoint(destination));
  url.searchParams.set("travelmode", "driving");
  url.searchParams.set("dir_action", "navigate");
  return url.toString();
}

export function buildGoogleMapsTourUrl(
  origin: GeoPoint,
  destination: GeoPoint,
  waypoints: GeoPoint[]
): string {
  return buildGoogleMapsTourUrlDetailed(origin, destination, waypoints).url;
}

export function buildGoogleMapsTourUrlDetailed(
  origin: GeoPoint,
  destination: GeoPoint,
  waypoints: GeoPoint[]
): GoogleMapsTourUrlResult {
  if (!isValidGeoPoint(origin)) {
    throw new Error("Coordinate di partenza non valide per Google Maps.");
  }
  if (!isValidGeoPoint(destination)) {
    throw new Error("Coordinate di arrivo non valide per Google Maps.");
  }

  const validWaypoints = waypoints.filter(isValidGeoPoint);
  const truncated = validWaypoints.length > GOOGLE_MAPS_MAX_WAYPOINTS;
  const usedWaypoints = truncated
    ? validWaypoints.slice(0, GOOGLE_MAPS_MAX_WAYPOINTS)
    : validWaypoints;

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", formatPoint(origin));
  url.searchParams.set("destination", formatPoint(destination));

  if (usedWaypoints.length > 0) {
    url.searchParams.set(
      "waypoints",
      usedWaypoints.map((point) => formatPoint(point)).join("|")
    );
  }

  url.searchParams.set("travelmode", "driving");
  url.searchParams.set("dir_action", "navigate");

  const warning = truncated
    ? `Google Maps accetta al massimo ${GOOGLE_MAPS_MAX_WAYPOINTS} tappe intermedie: il link include solo le prime ${GOOGLE_MAPS_MAX_WAYPOINTS} di ${validWaypoints.length}.`
    : validWaypoints.length > 8
      ? "Molte tappe nel link: verifica su Google Maps che tutte le fermate siano incluse."
      : null;

  return {
    url: url.toString(),
    waypointCount: usedWaypoints.length,
    truncated,
    warning,
  };
}

/**
 * Se le tappe intermedie superano il limite Google Maps, spezza in più URL.
 * Con ≤10 waypoint (es. 4 tappe) restituisce un solo link.
 */
export function segmentGoogleMapsTourUrls(
  origin: GeoPoint,
  destination: GeoPoint,
  waypoints: GeoPoint[]
): string[] {
  const validWaypoints = waypoints.filter(isValidGeoPoint);
  if (validWaypoints.length <= GOOGLE_MAPS_MAX_WAYPOINTS) {
    return [buildGoogleMapsTourUrl(origin, destination, validWaypoints)];
  }

  const urls: string[] = [];
  let segmentOrigin = origin;

  for (let i = 0; i < validWaypoints.length; i += GOOGLE_MAPS_MAX_WAYPOINTS) {
    const chunk = validWaypoints.slice(i, i + GOOGLE_MAPS_MAX_WAYPOINTS);
    const isLast = i + GOOGLE_MAPS_MAX_WAYPOINTS >= validWaypoints.length;
    const segmentDestination = isLast ? destination : chunk[chunk.length - 1]!;
    const segmentWaypoints = isLast ? chunk : chunk.slice(0, -1);
    urls.push(buildGoogleMapsTourUrl(segmentOrigin, segmentDestination, segmentWaypoints));
    segmentOrigin = segmentDestination;
  }

  return urls;
}

/** Costruisce l'URL se le coordinate sono valide; altrimenti null (niente throw in UI). */
export function tryBuildGoogleMapsTourUrl(
  origin: GeoPoint | null | undefined,
  destination: GeoPoint | null | undefined,
  waypoints: GeoPoint[]
): string | null {
  if (!isValidGeoPoint(origin) || !isValidGeoPoint(destination)) {
    return null;
  }
  try {
    return buildGoogleMapsTourUrl(origin, destination, waypoints);
  } catch {
    return null;
  }
}
