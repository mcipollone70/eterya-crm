import { GEOCODED_MAP_STATUSES } from "@/features/maps/constants/map-config";
import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import type { NearbyRadiusKm } from "@/features/maps/constants/map-config";
import { RADAR_COMMERCIAL_STATUSES, type RadarCompanySource } from "../types";

const GEOCODED_STATUS_SET = new Set<string>(GEOCODED_MAP_STATUSES);
const RADAR_STATUS_SET = new Set<string>(RADAR_COMMERCIAL_STATUSES);

export function filterCompaniesForRadar(
  companies: RadarCompanySource[],
  center: { lat: number; lng: number },
  radiusKm: NearbyRadiusKm
): RadarCompanySource[] {
  return companies.filter((company) => {
    if (!RADAR_STATUS_SET.has(company.commercial_status)) {
      return false;
    }

    if (company.geocode_status && !GEOCODED_STATUS_SET.has(company.geocode_status)) {
      return false;
    }

    const distanceKm = getDistanceKm(
      center.lat,
      center.lng,
      company.latitude,
      company.longitude
    );

    return distanceKm <= radiusKm;
  });
}

export function collectRadarCompanyIds(
  companies: RadarCompanySource[],
  center: { lat: number; lng: number },
  radiusKm: NearbyRadiusKm
): string[] {
  return filterCompaniesForRadar(companies, center, radiusKm).map((company) => company.id);
}
