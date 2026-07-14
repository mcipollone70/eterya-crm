import { isCompanyPriorityExcluded } from "@/lib/commercial-priority/is-excluded";
import type { CommercialStatus, CompanyStatus, Json } from "@/lib/supabase/types";

export interface VisitTourCompanyLike {
  id: string;
  name: string;
  status: CompanyStatus;
  commercial_status: CommercialStatus;
  latitude: number;
  longitude: number;
  import_payload: Json | null;
  lastVisitAt: string | null;
}

export function isVisitedToday(lastVisitAt: string | null, visitedTodayIds: Set<string>, companyId: string): boolean {
  if (visitedTodayIds.has(companyId)) {
    return true;
  }

  if (!lastVisitAt) {
    return false;
  }

  const visitDate = new Date(lastVisitAt);
  const today = new Date();
  return (
    visitDate.getFullYear() === today.getFullYear() &&
    visitDate.getMonth() === today.getMonth() &&
    visitDate.getDate() === today.getDate()
  );
}

export function getVisitTourExclusionReason(
  company: VisitTourCompanyLike,
  visitedTodayIds: Set<string>
): string | null {
  if (company.latitude == null || company.longitude == null) {
    return "Senza coordinate";
  }

  if (
    isCompanyPriorityExcluded({
      companyStatus: company.status,
      name: company.name,
      importPayload: company.import_payload,
    })
  ) {
    return "Cessata o in liquidazione";
  }

  if (company.commercial_status === "non_interessato") {
    return "Non interessato";
  }

  if (isVisitedToday(company.lastVisitAt, visitedTodayIds, company.id)) {
    return "Già visitata oggi";
  }

  return null;
}

export function isVisitTourEligible(
  company: VisitTourCompanyLike,
  visitedTodayIds: Set<string>
): boolean {
  return getVisitTourExclusionReason(company, visitedTodayIds) === null;
}
