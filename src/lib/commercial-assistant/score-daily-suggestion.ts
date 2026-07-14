import { computeCompanyPriorityFields } from "@/lib/commercial-priority/compute";
import { daysSince } from "@/lib/commercial-priority/is-excluded";
import type { PriorityContext } from "@/lib/commercial-priority/types";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import type { VisitTourCompanyLike } from "@/lib/visit-tour/eligibility";
import type { VisitTourOptimizeContext } from "@/lib/visit-tour/scoring";
import type { DailySuggestionSignals, OpportunityAggregate } from "./types";

function formatKm(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export interface DailySuggestionScoreInput {
  company: VisitTourCompanyLike & { revenue?: number | null; city?: string | null };
  context: VisitTourOptimizeContext;
  distanceKm: number | null;
  opportunity: OpportunityAggregate | null;
  hasHighProductInterest: boolean;
  purchasedProductCount: number;
}

export interface DailySuggestionScoreResult {
  score: number;
  reasons: string[];
  signals: DailySuggestionSignals;
}

function revenueBonus(revenue: number | null): number {
  if (revenue == null || revenue <= 0) {
    return 0;
  }
  return Math.min(10, Math.floor(Math.log10(revenue + 1) * 4));
}

function pipelineValueBonus(value: number): number {
  if (value <= 0) {
    return 0;
  }
  return Math.min(12, Math.floor(Math.log10(value + 1) * 5));
}

function probabilityBonus(probability: number | null): number {
  if (probability == null || probability <= 0) {
    return 0;
  }
  if (probability >= 70) {
    return 15;
  }
  if (probability >= 40) {
    return 10;
  }
  return 5;
}

export function scoreDailyVisitSuggestion(
  input: DailySuggestionScoreInput
): DailySuggestionScoreResult {
  const { company, context, distanceKm, opportunity, hasHighProductInterest, purchasedProductCount } =
    input;
  const reasons: string[] = [];
  const overdueSet = new Set(context.overdueFollowUpCompanyIds);
  const openOpportunitySet = new Set(context.openOpportunityCompanies);

  const priority = computeCompanyPriorityFields(
    {
      id: company.id,
      name: company.name,
      status: company.status,
      commercial_status: company.commercial_status,
      revenue: company.revenue ?? null,
      import_payload: company.import_payload,
    },
    context as PriorityContext,
    {
      distanceKm,
      alongActiveRoute: distanceKm !== null && distanceKm <= 10,
    }
  );

  let score = priority.priority_score;
  const visitDays = daysSince(company.lastVisitAt);
  const hasOverdueFollowUp = overdueSet.has(company.id);

  if (hasOverdueFollowUp) {
    score += 18;
    reasons.push("Follow-up scaduto");
  }

  if (openOpportunitySet.has(company.id) || (opportunity?.count ?? 0) > 0) {
    score += 12;
    if (opportunity && opportunity.maxProbability != null && opportunity.maxProbability >= 70) {
      reasons.push(`Opportunità calda (${opportunity.maxProbability}%)`);
    } else {
      reasons.push("Opportunità aperta");
    }
  }

  if (opportunity) {
    score += probabilityBonus(opportunity.maxProbability);
    score += pipelineValueBonus(opportunity.totalValue);
    if (opportunity.totalValue > 0 && !reasons.some((reason) => reason.includes("Opportunità"))) {
      reasons.push(`Pipeline €${Math.round(opportunity.totalValue).toLocaleString("it-IT")}`);
    }
  }

  if (!company.lastVisitAt) {
    score += 10;
    reasons.push("Mai visitata");
  } else if (visitDays !== null && visitDays > 30) {
    score += 8;
    reasons.push(`Ultima visita ${visitDays} giorni fa`);
  }

  if (company.commercial_status === "da_ricontattare") {
    score += 6;
    reasons.push(COMMERCIAL_STATUS_LABELS.da_ricontattare);
  } else if (company.commercial_status === "cliente") {
    if (visitDays === null || visitDays > 90) {
      score += 8;
      reasons.push("Cliente inattivo (>90 gg)");
    }
  }

  if (hasHighProductInterest) {
    score += 6;
    reasons.push("Interesse prodotto elevato");
  }

  if (purchasedProductCount > 0) {
    score += Math.min(5, purchasedProductCount);
    if (purchasedProductCount >= 2) {
      reasons.push(`${purchasedProductCount} prodotti acquistati`);
    }
  }

  score += revenueBonus(company.revenue ?? null);

  if (distanceKm !== null) {
    if (distanceKm <= 5) {
      score += 8;
      reasons.push(`Vicino (${formatKm(distanceKm)})`);
    } else if (distanceKm <= 15) {
      score += 4;
      reasons.push(`Distanza ${formatKm(distanceKm)}`);
    } else {
      const distancePenalty = Math.min(25, Math.round(distanceKm * 0.8));
      score = Math.max(0, score - distancePenalty);
      if (distanceKm > 30) {
        reasons.push(`Lontana (${formatKm(distanceKm)})`);
      }
    }
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

  const uniqueReasons = [...new Set(reasons)].slice(0, 4);
  if (uniqueReasons.length === 0) {
    uniqueReasons.push("Priorità commerciale");
  }

  return {
    score,
    reasons: uniqueReasons,
    signals: {
      distanceKm,
      daysSinceLastVisit: visitDays,
      hasOverdueFollowUp,
      openOpportunityCount: opportunity?.count ?? 0,
      maxOpportunityProbability: opportunity?.maxProbability ?? null,
      openPipelineValue: opportunity?.totalValue ?? 0,
      revenue: company.revenue ?? null,
      hasHighProductInterest,
      purchasedProductCount,
    },
  };
}
