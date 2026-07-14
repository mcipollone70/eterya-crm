import { GEOCODED_MAP_STATUSES } from "../constants/map-config";
import type {
  MapCompany,
  NearbyCommercialStatusFilter,
  NearbyCompanyResult,
  NearbyFiltersState,
  UserLocation,
} from "../types/map";
import { getDistanceKm } from "./geo-distance";

const GEOCODED_STATUS_SET = new Set<string>(GEOCODED_MAP_STATUSES);

export function findNearbyCompanies(
  companies: MapCompany[],
  userLocation: UserLocation,
  filters: NearbyFiltersState
): NearbyCompanyResult[] {
  const statusSet = new Set(filters.commercialStatuses);

  return companies
    .filter((company) => {
      if (!GEOCODED_STATUS_SET.has(company.geocode_status)) {
        return false;
      }

      if (
        statusSet.size > 0 &&
        !statusSet.has(company.commercial_status as NearbyCommercialStatusFilter)
      ) {
        return false;
      }

      if (filters.province && company.province !== filters.province) {
        return false;
      }

      if (filters.city && company.city !== filters.city) {
        return false;
      }

      return true;
    })
    .map((company) => ({
      ...company,
      distanceKm: getDistanceKm(
        userLocation.lat,
        userLocation.lng,
        company.latitude,
        company.longitude
      ),
    }))
    .filter((company) => company.distanceKm <= filters.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
