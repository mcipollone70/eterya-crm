import type { GeoPoint } from "../types/visit-tour";

/** Google Maps URL supporta al massimo ~10 tappe intermedie. */
export const GOOGLE_MAPS_MAX_WAYPOINTS = 10;

function formatPoint(point: GeoPoint): string {
  return `${point.lat},${point.lng}`;
}

export interface GoogleMapsTourUrlResult {
  url: string;
  waypointCount: number;
  truncated: boolean;
  warning: string | null;
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
  const truncated = waypoints.length > GOOGLE_MAPS_MAX_WAYPOINTS;
  const usedWaypoints = truncated
    ? waypoints.slice(0, GOOGLE_MAPS_MAX_WAYPOINTS)
    : waypoints;

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

  const warning = truncated
    ? `Google Maps accetta al massimo ${GOOGLE_MAPS_MAX_WAYPOINTS} tappe intermedie: il link include solo le prime ${GOOGLE_MAPS_MAX_WAYPOINTS} di ${waypoints.length}.`
    : waypoints.length > 8
      ? "Molte tappe nel link: verifica su Google Maps che tutte le fermate siano incluse."
      : null;

  return {
    url: url.toString(),
    waypointCount: usedWaypoints.length,
    truncated,
    warning,
  };
}
