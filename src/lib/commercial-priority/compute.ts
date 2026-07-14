import { calculateCommercialPriority } from "./calculate-score";
import type {
  CommercialPriorityInput,
  CompanyPriorityFields,
  CompanyPrioritySource,
  PriorityComputationOptions,
  PriorityContext,
  PriorityTier,
} from "./types";
import { normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import type { PriorityFilterValue } from "@/lib/constants/priority-tier";

export function buildPriorityInput(
  company: CompanyPrioritySource,
  context: PriorityContext,
  options?: PriorityComputationOptions
): CommercialPriorityInput {
  return {
    commercialStatus: normalizeCommercialStatus(company.commercial_status),
    companyStatus: company.status,
    name: company.name,
    importPayload: company.import_payload,
    revenue: company.revenue,
    lastVisitAt: context.lastVisitByCompany[company.id] ?? null,
    lastContactAt: context.lastContactByCompany[company.id] ?? null,
    hasOpenOpportunity: context.openOpportunityCompanies.includes(company.id),
    distanceKm: options?.distanceKm ?? null,
    alongActiveRoute: options?.alongActiveRoute ?? false,
  };
}

export function computeCompanyPriorityFields(
  company: CompanyPrioritySource,
  context: PriorityContext,
  options?: PriorityComputationOptions
): CompanyPriorityFields {
  const result = calculateCommercialPriority(buildPriorityInput(company, context, options));

  return {
    priority_score: result.score,
    priority_tier: result.tier,
    priority_excluded: result.excluded,
  };
}

export function matchesPriorityFilter(
  tier: PriorityTier,
  filter: PriorityFilterValue | null
): boolean {
  if (!filter) {
    return true;
  }

  return tier === filter;
}
