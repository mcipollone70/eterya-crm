import type { GeoPoint, VisitTourRoute, VisitTourRouteLeg } from "../types/visit-tour";
import { geoJsonLineToPoints } from "./route-geometry";

const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

function formatCoords(points: GeoPoint[]): string {
  return points.map((point) => `${point.lng},${point.lat}`).join(";");
}

export async function fetchDrivingRoute(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<VisitTourRoute> {
  const url = `${OSRM_BASE_URL}/${formatCoords([origin, destination])}?overview=full&geometries=geojson`;

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
      duration?: number;
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
    durationMinutes: Math.round((route.duration ?? 0) / 60),
  };
}

/**
 * Calcola distanze/tempi di guida reali tra punti consecutivi via OSRM.
 * Un'unica richiesta multi-waypoint; lancia se il routing fallisce.
 */
export async function fetchDrivingRouteLegs(points: GeoPoint[]): Promise<{
  legs: VisitTourRouteLeg[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
}> {
  if (points.length < 2) {
    return { legs: [], totalDistanceKm: 0, totalDurationMinutes: 0 };
  }

  const url = `${OSRM_BASE_URL}/${formatCoords(points)}?overview=false&annotations=false`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Impossibile calcolare i tratti (OSRM ${response.status}).`);
  }

  const payload = (await response.json()) as {
    routes?: Array<{
      distance?: number;
      duration?: number;
      legs?: Array<{ distance?: number; duration?: number }>;
    }>;
    code?: string;
    message?: string;
  };

  if (payload.code !== "Ok" || !payload.routes?.[0]) {
    throw new Error(payload.message ?? "Tratti percorso non disponibili.");
  }

  const route = payload.routes[0]!;
  const legs: VisitTourRouteLeg[] = (route.legs ?? []).map((leg) => ({
    distanceKm: (leg.distance ?? 0) / 1000,
    durationMinutes: Math.round((leg.duration ?? 0) / 60),
  }));

  return {
    legs,
    totalDistanceKm: (route.distance ?? 0) / 1000,
    totalDurationMinutes: Math.round((route.duration ?? 0) / 60),
  };
}
