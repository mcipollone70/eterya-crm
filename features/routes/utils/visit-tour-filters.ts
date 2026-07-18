import type { VisitTourCompany, VisitTourPlannerFilters } from "../types/visit-tour";

export function applyVisitTourPlannerFilters(
  companies: VisitTourCompany[],
  filters: VisitTourPlannerFilters
): VisitTourCompany[] {
  return companies.filter((company) => {
    if (filters.commercialStatus && company.commercial_status !== filters.commercialStatus) {
      return false;
    }

    if (filters.companyStatus && company.status !== filters.companyStatus) {
      return false;
    }

    if (filters.province) {
      const province = company.province?.trim().toUpperCase() ?? "";
      if (province !== filters.province.trim().toUpperCase()) {
        return false;
      }
    }

    if (filters.municipality) {
      const city = company.city?.trim().toLowerCase() ?? "";
      if (!city.includes(filters.municipality.trim().toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}
