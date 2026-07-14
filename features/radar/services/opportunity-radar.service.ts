import "server-only";

import { cache } from "react";
import { fetchVisitTourOptimizeContext } from "@/features/routes/services/visit-tour-optimize.service";
import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import { getPriorityTier } from "@/lib/commercial-priority/calculate-score";
import { computeCompanyPriorityFields } from "@/lib/commercial-priority/compute";
import { scoreDailyVisitSuggestion } from "@/lib/commercial-assistant/score-daily-suggestion";
import type { OpportunityAggregate } from "@/lib/commercial-assistant/types";
import { normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import {
  isProductFamily,
  PRODUCT_FAMILY_LABELS,
} from "@/lib/constants/product-catalog";
import { OPEN_OPPORTUNITY_STAGES } from "@/lib/constants/opportunity-pipeline";
import { formatVisitDateShort } from "@/lib/last-visit/format";
import { getVisitTourExclusionReason } from "@/lib/visit-tour/eligibility";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { CommercialStatus, CompanyStatus, Json } from "@/lib/supabase/types";
import type {
  OpportunityRadarAnalyzeInput,
  OpportunityRadarAnalyzeResult,
  OpportunityRadarItem,
} from "../types";
import { RADAR_COMMERCIAL_STATUSES } from "../types";

const RADAR_STATUS_SET = new Set<string>(RADAR_COMMERCIAL_STATUSES);

const RADAR_COMPANY_COLUMNS =
  "id,name,city,province,latitude,longitude,commercial_status,status,revenue,last_visit_at,phone,contact_phone,mobile,phone_secondary,import_headers,import_payload";

type RadarCompanyRow = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  commercial_status: CommercialStatus | null;
  status: CompanyStatus;
  revenue: number | null;
  last_visit_at: string | null;
  phone: string | null;
  contact_phone: string | null;
  mobile: string | null;
  phone_secondary: string | null;
  import_headers: string[] | null;
  import_payload: Json | null;
};

const fetchOpportunityAggregates = cache(async (): Promise<Map<string, OpportunityAggregate>> => {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("opportunities")
    .select("company_id,total_amount,probability")
    .in("stage", [...OPEN_OPPORTUNITY_STAGES])
    .not("company_id", "is", null);

  const map = new Map<string, OpportunityAggregate>();

  for (const row of data ?? []) {
    if (!row.company_id) {
      continue;
    }
    const current = map.get(row.company_id) ?? {
      count: 0,
      totalValue: 0,
      maxProbability: null,
    };
    current.count += 1;
    current.totalValue += Number(row.total_amount ?? 0);
    const probability = row.probability != null ? Number(row.probability) : null;
    if (probability != null) {
      current.maxProbability =
        current.maxProbability == null
          ? probability
          : Math.max(current.maxProbability, probability);
    }
    map.set(row.company_id, current);
  }

  return map;
});

const fetchProductSignals = cache(async (): Promise<{
  highInterestCompanyIds: Set<string>;
  purchasedCountByCompany: Map<string, number>;
  interestFamiliesByCompany: Map<string, string[]>;
}> => {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("company_product_interests")
    .select("company_id,relation_type,interest_level,products(family)");

  const highInterestCompanyIds = new Set<string>();
  const purchasedCountByCompany = new Map<string, number>();
  const interestFamiliesByCompany = new Map<string, string[]>();

  type ProductInterestRow = {
    company_id: string | null;
    relation_type: string;
    interest_level: string | null;
    products: { family: string } | { family: string }[] | null;
  };

  for (const row of (data ?? []) as ProductInterestRow[]) {
    if (!row.company_id) {
      continue;
    }

    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const family = product?.family;

    if (row.relation_type === "purchased") {
      purchasedCountByCompany.set(
        row.company_id,
        (purchasedCountByCompany.get(row.company_id) ?? 0) + 1
      );
    }

    if (row.relation_type === "interest") {
      if (row.interest_level === "high") {
        highInterestCompanyIds.add(row.company_id);
      }
      if (family && isProductFamily(family)) {
        const label = PRODUCT_FAMILY_LABELS[family];
        const current = interestFamiliesByCompany.get(row.company_id) ?? [];
        if (!current.includes(label)) {
          interestFamiliesByCompany.set(row.company_id, [...current, label]);
        }
      }
    }
  }

  return { highInterestCompanyIds, purchasedCountByCompany, interestFamiliesByCompany };
});

function resolvePhone(row: RadarCompanyRow): string | null {
  return row.phone ?? row.contact_phone ?? row.mobile ?? row.phone_secondary ?? null;
}

function enhanceRadarReasons(
  reasons: string[],
  score: number,
  daysSinceLastVisit: number | null,
  interestFamilies: string[]
): { reasons: string[]; primaryReason: string } {
  const enhanced = [...reasons];

  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 180) {
    enhanced.unshift(`Cliente inattivo da ${daysSinceLastVisit} giorni`);
  }

  if (interestFamilies.length > 0) {
    const familyLabel = interestFamilies[0];
    const familyReason = `Interessato alle ${familyLabel}`;
    if (!enhanced.some((reason) => reason.toLowerCase().includes(familyLabel.toLowerCase()))) {
      enhanced.unshift(familyReason);
    }
  }

  if (score >= 70 && !enhanced.includes("Alto potenziale")) {
    enhanced.push("Alto potenziale");
  }

  const unique = [...new Set(enhanced)].slice(0, 4);
  return {
    reasons: unique,
    primaryReason: unique[0] ?? "Priorità commerciale",
  };
}

export async function analyzeOpportunityRadar(
  input: OpportunityRadarAnalyzeInput
): Promise<OpportunityRadarAnalyzeResult> {
  const uniqueIds = [...new Set(input.companyIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return { items: [], error: null };
  }

  const supabase = await createServerClient();
  const [companiesRes, optimizeContext, opportunityMap, productSignals] = await Promise.all([
    supabase.from("companies").select(RADAR_COMPANY_COLUMNS).in("id", uniqueIds),
    fetchVisitTourOptimizeContext(),
    fetchOpportunityAggregates(),
    fetchProductSignals(),
  ]);

  if (companiesRes.error) {
    return { items: [], error: describeDbError(companiesRes.error) };
  }

  const visitedTodaySet = new Set(optimizeContext.visitedTodayCompanyIds);
  const rows = (companiesRes.data ?? []) as RadarCompanyRow[];
  const items: OpportunityRadarItem[] = [];

  for (const row of rows) {
    if (row.latitude == null || row.longitude == null) {
      continue;
    }

    const commercialStatus = normalizeCommercialStatus(row.commercial_status);
    if (!RADAR_STATUS_SET.has(commercialStatus)) {
      continue;
    }

    const distanceKm = getDistanceKm(
      input.centerLat,
      input.centerLng,
      row.latitude,
      row.longitude
    );

    if (distanceKm > input.radiusKm) {
      continue;
    }

    const company = {
      id: row.id,
      name: row.name,
      status: row.status,
      commercial_status: commercialStatus,
      latitude: row.latitude,
      longitude: row.longitude,
      import_payload: row.import_payload,
      lastVisitAt: row.last_visit_at,
    };

    const exclusion = getVisitTourExclusionReason(company, visitedTodaySet);
    if (exclusion) {
      continue;
    }

    const opportunity = opportunityMap.get(row.id) ?? null;
    const interestFamilies = productSignals.interestFamiliesByCompany.get(row.id) ?? [];

    const scored = scoreDailyVisitSuggestion({
      company: { ...company, revenue: row.revenue, city: row.city },
      context: optimizeContext,
      distanceKm,
      opportunity,
      hasHighProductInterest: productSignals.highInterestCompanyIds.has(row.id),
      purchasedProductCount: productSignals.purchasedCountByCompany.get(row.id) ?? 0,
    });

    if (scored.score <= 0) {
      continue;
    }

    const priority = computeCompanyPriorityFields(
      {
        id: row.id,
        name: row.name,
        status: row.status,
        commercial_status: commercialStatus,
        revenue: row.revenue,
        import_payload: row.import_payload,
      },
      optimizeContext,
      { distanceKm, alongActiveRoute: distanceKm <= 10 }
    );

    const { reasons, primaryReason } = enhanceRadarReasons(
      scored.reasons,
      scored.score,
      scored.signals.daysSinceLastVisit,
      interestFamilies
    );

    items.push({
      companyId: row.id,
      companyName: row.name,
      city: row.city,
      province: row.province,
      phone: resolvePhone(row),
      latitude: row.latitude,
      longitude: row.longitude,
      commercialStatus,
      distanceKm,
      score: scored.score,
      tier: getPriorityTier(scored.score),
      priorityScore: priority.priority_score,
      opportunityValue: opportunity?.totalValue ?? 0,
      lastVisitLabel: formatVisitDateShort(row.last_visit_at),
      primaryReason,
      reasons,
    });
  }

  items.sort((left, right) => right.score - left.score || left.distanceKm - right.distanceKm);

  return { items, error: null };
}
