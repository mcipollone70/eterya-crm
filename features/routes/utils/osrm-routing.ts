import type { GeoPoint, VisitTourRoute } from "../types/visit-tour";
import { geoJsonLineToPoints } from "./route-geometry";

const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

export async function fetchDrivingRoute(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<VisitTourRoute> {
  const url = `${OSRM_BASE_URL}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Impossibile calcolare il percorso (OSRM ${response.status}).`);
  }

  const payload = (await response.json()) as {
    routes?: Array<{
      distance?: number;
      geometry?: { coordinates?: number[][] };
    }>;
    code?: string;
    message?: string;
  };

  if (payload.code !== "Ok" || !payload.routes?.[0]?.geometry?.coordinates) {
    throw new Error(payload.message ?? "Percorso non disponibile.");
  }

  const route = payload.routes[0]!;

  return {
    coordinates: geoJsonLineToPoints(route.geometry!.coordinates!),
    distanceKm: (route.distance ?? 0) / 1000,
  };
}
