import type { PriorityContext } from "./types";

/**
 * Costruisce un contesto priorità per una singola azienda usando campi denormalizzati.
 * Evita mappe globali quando last visit/contact sono già sulla riga company.
 */
export function buildRowPriorityContext(
  companyId: string,
  lastVisitAt: string | null,
  lastContactAt: string | null,
  openOpportunityCompanyIds: ReadonlySet<string>
): PriorityContext {
  return {
    lastVisitByCompany: lastVisitAt ? { [companyId]: lastVisitAt } : {},
    lastContactByCompany: lastContactAt ? { [companyId]: lastContactAt } : {},
    openOpportunityCompanies: openOpportunityCompanyIds.has(companyId) ? [companyId] : [],
  };
}

/**
 * Aggrega mappe visita/contatto da righe company (per fetchPriorityContext legacy).
 */
export function buildPriorityContextMaps(
  companies: ReadonlyArray<{
    id: string;
    last_visit_at: string | null;
    last_contact_at: string | null;
  }>,
  openOpportunityCompanyIds: readonly string[]
): Pick<PriorityContext, "lastVisitByCompany" | "lastContactByCompany"> {
  void openOpportunityCompanyIds;
  const lastVisitByCompany: Record<string, string> = {};
  const lastContactByCompany: Record<string, string> = {};

  for (const company of companies) {
    if (company.last_visit_at) {
      lastVisitByCompany[company.id] = company.last_visit_at;
    }
    if (company.last_contact_at) {
      lastContactByCompany[company.id] = company.last_contact_at;
    }
  }

  return { lastVisitByCompany, lastContactByCompany };
}
