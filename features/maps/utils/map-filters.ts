import type { MapCompany } from "../types/map";
import { GEOCODED_MAP_STATUSES } from "../constants/map-config";
import type { MapFiltersState } from "../types/map";

const GEOCODED_STATUS_SET = new Set<string>(GEOCODED_MAP_STATUSES);

export function filterMapCompanies(
  companies: MapCompany[],
  filters: MapFiltersState
): MapCompany[] {
  return companies.filter((company) => {
    if (filters.geolocatedOnly && !GEOCODED_STATUS_SET.has(company.geocode_status)) {
      return false;
    }

    if (filters.commercialStatus && company.commercial_status !== filters.commercialStatus) {
      return false;
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

export function buildCompanyPopupHtml(company: MapCompany): string {
  const address = company.address ?? "—";
  const phone = company.phone ?? "—";
  const mapsUrl = buildGoogleMapsDirectionsUrl(company.latitude, company.longitude);

  return `
    <div class="space-y-2 text-sm text-slate-800">
      <p class="font-semibold">${escapeHtml(company.name)}</p>
      <p>${escapeHtml(address)}</p>
      <p>${escapeHtml(phone)}</p>
      <div class="flex flex-col gap-1 pt-1">
        <a href="/companies/${company.id}" class="font-medium text-indigo-600 hover:underline">
          Apri scheda azienda
        </a>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="font-medium text-indigo-600 hover:underline">
          Naviga con Google Maps
        </a>
      </div>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
