import type { PriorityTier } from "./types";
import type { CommercialPriorityInput, CommercialPriorityResult } from "./types";
import { daysSince, isCompanyPriorityExcluded } from "./is-excluded";

export const PRIORITY_TIER_THRESHOLDS = {
  high: 70,
  medium: 40,
} as const;

export function getPriorityTier(score: number): PriorityTier {
  if (score >= PRIORITY_TIER_THRESHOLDS.high) {
    return "high";
  }
  if (score >= PRIORITY_TIER_THRESHOLDS.medium) {
    return "medium";
  }
  if (score > 0) {
    return "low";
  }
  return "none";
}

/**
 * Motore priorità commerciale (0–100).
 * Regole additive con tetto massimo 100.
 */
export function calculateCommercialPriority(
  input: CommercialPriorityInput
): CommercialPriorityResult {
  if (
    isCompanyPriorityExcluded({
      companyStatus: input.companyStatus,
      name: input.name,
      importPayload: input.importPayload,
    })
  ) {
    return { score: 0, tier: "none", excluded: true };
  }

  if (input.commercialStatus === "non_interessato") {
    return { score: 0, tier: "none", excluded: false };
  }

  let score = 0;

  if (input.commercialStatus === "da_ricontattare") {
    score += 25;
  }

  if (input.commercialStatus === "prospect" && !input.lastVisitAt) {
    score += 20;
  }

  if (input.commercialStatus === "cliente") {
    const visitDays = daysSince(input.lastVisitAt);
    if (visitDays === null || visitDays > 90) {
      score += 25;
    }
  }

  if (input.distanceKm !== null && input.distanceKm <= 10) {
    score += 15;
  }

  if (input.alongActiveRoute) {
    score += 20;
  }

  if (input.hasOpenOpportunity) {
    score += 15;
  }

  const contactDays = daysSince(input.lastContactAt);
  if (contactDays === null || contactDays > 30) {
    score += 10;
  }

  const visitDays = daysSince(input.lastVisitAt);
  if (visitDays !== null && visitDays > 30 && visitDays <= 90) {
    score += 10;
  }

  if (input.revenue !== null && input.revenue > 0) {
    score += Math.min(15, Math.floor(Math.log10(input.revenue + 1) * 5));
  } else if (input.commercialStatus === "prospect") {
    score += 5;
  }

  const finalScore = Math.min(100, Math.max(0, score));

  return {
    score: finalScore,
    tier: getPriorityTier(finalScore),
    excluded: false,
  };
}
