"use server";

import type { MapFiltersState, MapGeoBounds } from "../types/map";

/** Solo plain objects serializzabili verso Server Action (niente Leaflet/Set/URLSearchParams). */
function serializeMapBounds(bounds: MapGeoBounds): MapGeoBounds {
  return {
    north: Number(bounds.north),
    south: Number(bounds.south),
    east: Number(bounds.east),
    west: Number(bounds.west),
  };
}

function serializeMapFilters(filters: MapFiltersState): MapFiltersState {
  const brandSlugs = Array.isArray(filters.brandSlugs)
    ? filters.brandSlugs.filter(
        (slug): slug is string => typeof slug === "string" && slug.length > 0
      )
    : [];
  const rawStatus = filters.commercialStatus as string | undefined;
  const commercialStatus =
    rawStatus && rawStatus !== "all"
      ? (rawStatus as MapFiltersState["commercialStatus"])
      : "";

  return {
    commercialStatus,
    brandSlugs,
    brandMatchMode: filters.brandMatchMode === "and" ? "and" : "or",
    province: typeof filters.province === "string" ? filters.province : "",
    city: typeof filters.city === "string" ? filters.city : "",
    geolocatedOnly: Boolean(filters.geolocatedOnly),
  };
}

export async function fetchMapCompaniesInBoundsAction(
  bounds: MapGeoBounds,
  filters: MapFiltersState,
  offset = 0
) {
  const { getMapCompaniesInBounds } = await import("../services/map-companies.service");
  return getMapCompaniesInBounds(
    serializeMapBounds(bounds),
    serializeMapFilters(filters),
    Math.max(0, Number(offset) || 0)
  );
}

export async function fetchMapFilterCitiesAction(province: string) {
  const { getMapFilterCities } = await import("../services/map-companies.service");
  return getMapFilterCities(typeof province === "string" ? province : "");
}
