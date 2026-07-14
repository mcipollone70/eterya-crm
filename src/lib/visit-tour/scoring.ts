import { computeCompanyPriorityFields } from "@/lib/commercial-priority/compute";
import { daysSince } from "@/lib/commercial-priority/is-excluded";
import type { PriorityContext } from "@/lib/commercial-priority/types";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import type { VisitTourCompanyLike } from "./eligibility";

export interface VisitTourOptimizeContext extends PriorityContext {
  overdueFollowUpCompanyIds: string[];
  visitedTodayCompanyIds: string[];
}

export interface StopScoreInput {
  distanceKm: number;
  routeDeviationKm: number;
  detourKm: number;
}

export interface StopScoreResult {
  score: number;
  reason: string;
}

export function scoreVisitTourStop(
  company: VisitTourCompanyLike & { revenue?: number | null },
  context: VisitTourOptimizeContext,
  metrics: StopScoreInput
): StopScoreResult {
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
    context,
    {
      distanceKm: metrics.distanceKm,
      alongActiveRoute: metrics.routeDeviationKm <= 2,
    }
  );

  let score = priority.priority_score;

  if (overdueSet.has(company.id)) {
    score += 18;
    reasons.push("Follow-up scaduto");
  }

  if (openOpportunitySet.has(company.id)) {
    score += 12;
    reasons.push("Opportunità aperta");
  }

  if (!company.lastVisitAt) {
    score += 10;
    reasons.push("Mai visitata");
  } else {
    const visitDays = daysSince(company.lastVisitAt);
    if (visitDays !== null && visitDays > 30) {
      score += 8;
      reasons.push(`Ultima visita ${visitDays} giorni fa`);
    }
  }

  if (company.commercial_status === "da_ricontattare") {
    reasons.push(COMMERCIAL_STATUS_LABELS.da_ricontattare);
  } else if (company.commercial_status === "prospect") {
    reasons.push(COMMERCIAL_STATUS_LABELS.prospect);
  } else if (company.commercial_status === "cliente") {
    const visitDays = daysSince(company.lastVisitAt);
    if (visitDays === null || visitDays > 90) {
      reasons.push("Cliente inattivo");
    } else {
      reasons.push(COMMERCIAL_STATUS_LABELS.cliente);
    }
  } else {
    reasons.push(COMMERCIAL_STATUS_LABELS[company.commercial_status]);
  }

  if (metrics.routeDeviationKm <= 1) {
    score += 6;
    reasons.push("Vicino al percorso");
  }

  const distancePenalty = metrics.distanceKm * 1.8 + metrics.detourKm * 2.5;
  score = Math.max(0, Math.round(score - distancePenalty));

  const reason =
    reasons.length > 0 ? reasons.slice(0, 3).join(" · ") : "Priorità commerciale";

  return { score, reason };
}
