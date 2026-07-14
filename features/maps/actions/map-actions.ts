"use server";

import type { MapFiltersState, MapGeoBounds } from "../types/map";

export async function fetchMapCompaniesInBoundsAction(
  bounds: MapGeoBounds,
  filters: MapFiltersState,
  offset = 0
) {
  const { getMapCompaniesInBounds } = await import("../services/map-companies.service");
  return getMapCompaniesInBounds(bounds, filters, offset);
}

export async function fetchMapFilterCitiesAction(province: string) {
  const { getMapFilterCities } = await import("../services/map-companies.service");
  return getMapFilterCities(province);
}
