import type { GeoPoint } from "../types/visit-tour";

function formatPoint(point: GeoPoint): string {
  return `${point.lat},${point.lng}`;
}

export function buildGoogleMapsTourUrl(
  origin: GeoPoint,
  destination: GeoPoint,
  waypoints: GeoPoint[]
): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", formatPoint(origin));
  url.searchParams.set("destination", formatPoint(destination));

  if (waypoints.length > 0) {
    url.searchParams.set(
      "waypoints",
      waypoints.map((point) => formatPoint(point)).join("|")
    );
  }

  url.searchParams.set("travelmode", "driving");
  return url.toString();
}
