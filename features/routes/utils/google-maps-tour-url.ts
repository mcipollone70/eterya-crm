import type { GeoPoint } from "../types/visit-tour";

/** Google Maps URL supporta al massimo ~10 tappe intermedie. */
export const GOOGLE_MAPS_MAX_WAYPOINTS = 10;

/** Target for Maps deep links: same-tab works reliably in iPhone PWA (no window.open). */
export const GOOGLE_MAPS_LINK_TARGET = "_self" as const;

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

export interface BuildGoogleMapsDirOptions {
  /** Omit to let Google Maps use the device current location. */
  origin?: GeoPoint | null;
  destination: GeoPoint;
  waypoints?: GeoPoint[];
  /** When true, request navigation start (dir_action=navigate). Default true. */
  navigate?: boolean;
}

function waypointWarning(usedCount: number, validCount: number, truncated: boolean): string | null {
  if (truncated) {
    return `Google Maps accetta al massimo ${GOOGLE_MAPS_MAX_WAYPOINTS} tappe intermedie: il link include solo le prime ${GOOGLE_MAPS_MAX_WAYPOINTS} di ${validCount}.`;
  }
  if (validCount > 8) {
    return "Molte tappe nel link: verifica su Google Maps che tutte le fermate siano incluse.";
  }
  return null;
}

/**
 * Universal HTTPS Maps directions URL via URLSearchParams.
 * Omitting origin = “from my position”. navigate=false = preview only.
 */
export function buildGoogleMapsDirUrl(options: BuildGoogleMapsDirOptions): GoogleMapsTourUrlResult {
  const { origin, destination, waypoints = [], navigate = true } = options;

  if (!isValidGeoPoint(destination)) {
    throw new Error("Coordinate destinazione non valide per Google Maps.");
  }
  if (origin != null && !isValidGeoPoint(origin)) {
    throw new Error("Coordinate di partenza non valide per Google Maps.");
  }

  const validWaypoints = waypoints.filter(isValidGeoPoint);
  const truncated = validWaypoints.length > GOOGLE_MAPS_MAX_WAYPOINTS;
  const usedWaypoints = truncated
    ? validWaypoints.slice(0, GOOGLE_MAPS_MAX_WAYPOINTS)
    : validWaypoints;

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");

  if (origin != null) {
    url.searchParams.set("origin", formatPoint(origin));
  }

  url.searchParams.set("destination", formatPoint(destination));

  if (usedWaypoints.length > 0) {
    url.searchParams.set(
      "waypoints",
      usedWaypoints.map((point) => formatPoint(point)).join("|")
    );
  }

  url.searchParams.set("travelmode", "driving");

  if (navigate) {
    url.searchParams.set("dir_action", "navigate");
  }

  return {
    url: url.toString(),
    waypointCount: usedWaypoints.length,
    truncated,
    warning: waypointWarning(usedWaypoints.length, validWaypoints.length, truncated),
  };
}

/** Navigazione verso una singola destinazione (tappa) dalla posizione attuale. */
export function buildGoogleMapsDestinationUrl(destination: GeoPoint): string {
  return buildGoogleMapsDirUrl({ destination, navigate: true }).url;
}

/**
 * Giro completo dalla posizione attuale: nessun origin, destination=ultima tappa,
 * waypoints=intermedie, dir_action=navigate.
 * Su iOS multi-tappa può restare in anteprima — preferire la tappa singola come CTA primaria.
 */
export function buildGoogleMapsTourUrlFromMyLocation(
  destination: GeoPoint,
  waypoints: GeoPoint[]
): GoogleMapsTourUrlResult {
  return buildGoogleMapsDirUrl({
    destination,
    waypoints,
    navigate: true,
  });
}

/** Anteprima giro pianificato con origin salvato (senza dir_action=navigate). */
export function buildGoogleMapsTourPreviewUrl(
  origin: GeoPoint,
  destination: GeoPoint,
  waypoints: GeoPoint[]
): GoogleMapsTourUrlResult {
  return buildGoogleMapsDirUrl({
    origin,
    destination,
    waypoints,
    navigate: false,
  });
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
  return buildGoogleMapsDirUrl({
    origin,
    destination,
    waypoints,
    navigate: true,
  });
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

export function tryBuildGoogleMapsTourUrlFromMyLocation(
  destination: GeoPoint | null | undefined,
  waypoints: GeoPoint[]
): string | null {
  if (!isValidGeoPoint(destination)) {
    return null;
  }
  try {
    return buildGoogleMapsTourUrlFromMyLocation(destination, waypoints).url;
  } catch {
    return null;
  }
}

export function tryBuildGoogleMapsTourPreviewUrl(
  origin: GeoPoint | null | undefined,
  destination: GeoPoint | null | undefined,
  waypoints: GeoPoint[]
): string | null {
  if (!isValidGeoPoint(origin) || !isValidGeoPoint(destination)) {
    return null;
  }
  try {
    return buildGoogleMapsTourPreviewUrl(origin, destination, waypoints).url;
  } catch {
    return null;
  }
}

export function tryBuildGoogleMapsDestinationUrl(
  destination: GeoPoint | null | undefined
): string | null {
  if (!isValidGeoPoint(destination)) {
    return null;
  }
  try {
    return buildGoogleMapsDestinationUrl(destination);
  } catch {
    return null;
  }
}
