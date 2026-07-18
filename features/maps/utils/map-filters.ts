import type { MapCompaniesStats, MapCompany } from "../types/map";
import { GEOCODED_MAP_STATUSES } from "../constants/map-config";
import type { MapFiltersState } from "../types/map";
import { companyMatchesMapCommercialStatusFilter } from "./map-brand-markers";
import {
  companyMatchesBrandFilters,
  companyMatchesBrandSlugs,
} from "@/features/brands/utils/brand-shared";
import type { CommercialStatus } from "@/lib/supabase/types";

function formatCount(value: number): string {
  return value.toLocaleString("it-IT");
}

/** Brand attivo solo con almeno uno slug. Array vuoto = tutti i Brand. */
export function hasMapBrandFilter(filters: Pick<MapFiltersState, "brandSlugs">): boolean {
  return Array.isArray(filters.brandSlugs) && filters.brandSlugs.length > 0;
}

/**
 * Relazione Cliente/Prospect attiva solo con valore concreto.
 * "" / "all" / nullish = tutti gli stati.
 */
export function hasMapRelationshipFilter(
  filters: Pick<MapFiltersState, "commercialStatus">
): boolean {
  const status = filters.commercialStatus as string | undefined;
  return Boolean(status) && status !== "all";
}

export function formatMapPageSubtitle(
  visibleCount: number,
  stats: MapCompaniesStats,
  filters: MapFiltersState
): string {
  if (stats.isTruncated) {
    return `${formatCount(visibleCount)} aziende visualizzate (prime ${formatCount(stats.loadedCount)} caricate su ${formatCount(stats.totalWithCoordinates)} con coordinate)`;
  }

  const hasExtraFilters =
    hasMapRelationshipFilter(filters) ||
    filters.province !== "" ||
    filters.city !== "" ||
    hasMapBrandFilter(filters);

  if (hasExtraFilters) {
    const reference = filters.geolocatedOnly
      ? stats.totalGeocodedConfirmed
      : stats.totalWithCoordinates;
    return `${formatCount(visibleCount)} aziende visualizzate con i filtri attivi (su ${formatCount(reference)} nel database)`;
  }

  if (filters.geolocatedOnly) {
    return `${formatCount(visibleCount)} aziende geolocalizzate visualizzate su ${formatCount(stats.totalGeocodedConfirmed)} geolocalizzate`;
  }

  return `${formatCount(visibleCount)} aziende visualizzate su ${formatCount(stats.totalWithCoordinates)} con coordinate`;
}

const GEOCODED_STATUS_SET = new Set<string>(GEOCODED_MAP_STATUSES);

export function filterMapCompanies(
  companies: MapCompany[],
  filters: MapFiltersState
): MapCompany[] {
  const brandFilterActive = hasMapBrandFilter(filters);
  const relationshipFilterActive = hasMapRelationshipFilter(filters);

  return companies.filter((company) => {
    if (filters.geolocatedOnly && !GEOCODED_STATUS_SET.has(company.geocode_status)) {
      return false;
    }

    const brands = company.brands ?? [];

    if (brandFilterActive) {
      if (
        !companyMatchesBrandSlugs(
          brands,
          filters.brandSlugs,
          filters.brandMatchMode ?? "or"
        )
      ) {
        return false;
      }
    }

    if (relationshipFilterActive) {
      const status = filters.commercialStatus as CommercialStatus;
      if (brandFilterActive) {
        if (
          !companyMatchesBrandFilters({
            brands,
            selectedSlugs: filters.brandSlugs,
            matchMode: filters.brandMatchMode ?? "or",
            commercialStatus: status,
            legacyCommercialStatus: company.commercial_status,
          })
        ) {
          return false;
        }
      } else if (!companyMatchesMapCommercialStatusFilter(company, status)) {
        return false;
      }
    }

    if (filters.province && company.province !== filters.province) {
      return false;
    }

    if (filters.city && company.city !== filters.city) {
      return false;
    }

    return true;
  });
}

export function getCitiesForProvince(
  companies: MapCompany[],
  province: string
): string[] {
  const cities = new Set<string>();

  for (const company of companies) {
    if (province && company.province !== province) {
      continue;
    }
    if (company.city?.trim()) {
      cities.add(company.city.trim());
    }
  }

  return Array.from(cities).sort((a, b) => a.localeCompare(b, "it"));
}

export function buildGoogleMapsDirectionsUrl(
  latitude: number,
  longitude: number
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

/** @deprecated Prefer buildMapCompanyPopupHtml — mantenuto per import esistenti. */
export { buildMapCompanyPopupHtml as buildCompanyPopupHtml } from "./map-brand-markers";
