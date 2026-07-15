"use server";

import type { GeoPoint, VisitTourRoute } from "../types/visit-tour";
import { fetchDrivingRoute } from "../utils/osrm-routing";

export async function fetchDrivingRouteAction(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<{ success: true; route: VisitTourRoute } | { success: false; message: string }> {
  try {
    const route = await fetchDrivingRoute(origin, destination);
    return { success: true, route };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Calcolo percorso non riuscito.",
    };
  }
}
