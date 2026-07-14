"use server";

import {
  fetchVisitTourOptimizeContext,
  saveVisitTour,
  type SaveVisitTourInput,
} from "../services/visit-tour-optimize.service";
import {
  deleteVisitTour,
  duplicateVisitTour,
  getVisitTourById,
  listVisitTourAgents,
  listVisitTours,
  renameVisitTour,
} from "../services/visit-tour-saved.service";
import type { VisitTourLoadedState, VisitTourListFilters, VisitTourGeoBounds } from "../types/visit-tour";
import { buildDefaultTourName, buildVisitTourLoadedState } from "../utils/visit-tour-restore";
import type { VisitTourOptimizeContext } from "@/lib/visit-tour/scoring";

export async function fetchVisitTourCompaniesInBoundsAction(
  bounds: VisitTourGeoBounds,
  offset = 0
) {
  const { getVisitTourCompaniesInBounds } = await import("../services/visit-tour-data.service");
  return getVisitTourCompaniesInBounds(bounds, offset);
}

export async function fetchVisitTourCompaniesByIdsAction(ids: string[]) {
  const { getVisitTourCompaniesByIds } = await import("../services/visit-tour-data.service");
  return getVisitTourCompaniesByIds(ids);
}

export async function searchVisitTourCompaniesAction(
  query: string,
  bounds: VisitTourGeoBounds | null = null
) {
  const { searchVisitTourCompanies } = await import("../services/visit-tour-data.service");
  return searchVisitTourCompanies(query, bounds);
}

export async function fetchVisitTourOptimizeContextAction(): Promise<VisitTourOptimizeContext> {
  return fetchVisitTourOptimizeContext();
}

export async function saveVisitTourAction(
  input: SaveVisitTourInput
): Promise<{ success: boolean; message: string; tourId?: string }> {
  return saveVisitTour(input);
}

export async function listVisitToursAction(filters: VisitTourListFilters = {}) {
  return listVisitTours(filters);
}

export async function listVisitTourAgentsAction() {
  return listVisitTourAgents();
}

export async function renameVisitTourAction(tourId: string, name: string) {
  return renameVisitTour(tourId, name);
}

export async function duplicateVisitTourAction(tourId: string) {
  return duplicateVisitTour(tourId);
}

export async function deleteVisitTourAction(tourId: string) {
  return deleteVisitTour(tourId);
}

export async function loadVisitTourAction(tourId: string): Promise<{
  success: boolean;
  message: string;
  tour?: VisitTourLoadedState;
}> {
  const { getVisitTourById } = await import("../services/visit-tour-saved.service");
  const { getVisitTourCompaniesByIds } = await import("../services/visit-tour-data.service");
  const { data: row, error } = await getVisitTourById(tourId);

  if (error || !row) {
    return { success: false, message: error ?? "Giro non trovato." };
  }

  const storedStops = Array.isArray(row.stops) ? row.stops : [];
  const companyIds = new Set<string>();

  for (const stop of storedStops) {
    if (stop && typeof stop === "object" && "companyId" in stop) {
      const companyId = String((stop as { companyId?: string }).companyId ?? "");
      if (companyId) {
        companyIds.add(companyId);
      }
    }
  }

  const origin = row.origin as { companyId?: string } | null;
  const destination = row.destination as { companyId?: string } | null;
  if (origin?.companyId) {
    companyIds.add(origin.companyId);
  }
  if (destination?.companyId) {
    companyIds.add(destination.companyId);
  }

  const companiesResult = await getVisitTourCompaniesByIds([...companyIds]);

  if (companiesResult.error) {
    return { success: false, message: companiesResult.error };
  }

  const loadedTour = buildVisitTourLoadedState({
    id: row.id,
    name:
      row.name?.trim() ||
      buildDefaultTourName(row.tour_date, Array.isArray(row.stops) ? row.stops.length : 0),
    tourDate: row.tour_date,
    notes: row.notes,
    origin: row.origin,
    destination: row.destination,
    constraints: row.constraints,
    stops: row.stops,
    totalDistanceKm: row.total_distance_km,
    estimatedMinutes: row.estimated_minutes,
    deviationKm: row.deviation_km,
    companies: companiesResult.data,
  });

  if (!loadedTour) {
    return {
      success: false,
      message: "Impossibile riaprire il giro: tappe non disponibili o aziende mancanti.",
    };
  }

  return { success: true, message: "Giro caricato.", tour: loadedTour };
}
