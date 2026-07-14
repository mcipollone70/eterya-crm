import "server-only";

import { cache } from "react";
import { getCurrentUser } from "@/features/auth/session";
import { fetchVisitTourOptimizeContext } from "@/features/routes/services/visit-tour-optimize.service";
import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import { getPriorityTier } from "@/lib/commercial-priority/calculate-score";
import { scoreDailyVisitSuggestion } from "@/lib/commercial-assistant/score-daily-suggestion";
import type {
  DailyVisitSuggestion,
  OpportunityAggregate,
} from "@/lib/commercial-assistant/types";
import { normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import { OPEN_OPPORTUNITY_STAGES } from "@/lib/constants/opportunity-pipeline";
import {
  getVisitTourExclusionReason,
  type VisitTourCompanyLike,
} from "@/lib/visit-tour/eligibility";
import { createServerClient } from "@/lib/supabase/server";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { describeDbError } from "@/lib/supabase/errors";
import type { CommercialStatus, CompanyStatus, Json } from "@/lib/supabase/types";

const SUGGESTION_COLUMNS =
  "id,name,city,province,latitude,longitude,commercial_status,status,revenue,last_visit_at,assigned_user_id,import_payload";

type SuggestionCompanyRow = {
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
  assigned_user_id: string | null;
  import_payload: Json | null;
};

function computeReferencePoint(
  companies: Array<{ latitude: number; longitude: number }>
): { latitude: number; longitude: number } | null {
  if (companies.length === 0) {
    return null;
  }

  const totals = companies.reduce(
    (acc, company) => ({
      lat: acc.lat + company.latitude,
      lng: acc.lng + company.longitude,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    latitude: totals.lat / companies.length,
    longitude: totals.lng / companies.length,
  };
}

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
}> => {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("company_product_interests")
    .select("company_id,relation_type,interest_level");

  const highInterestCompanyIds = new Set<string>();
  const purchasedCountByCompany = new Map<string, number>();

  for (const row of data ?? []) {
    if (!row.company_id) {
      continue;
    }
    if (row.relation_type === "purchased") {
      purchasedCountByCompany.set(
        row.company_id,
        (purchasedCountByCompany.get(row.company_id) ?? 0) + 1
      );
    }
    if (row.relation_type === "interest" && row.interest_level === "high") {
      highInterestCompanyIds.add(row.company_id);
    }
  }

  return { highInterestCompanyIds, purchasedCountByCompany };
});

function mapSuggestionCompany(row: SuggestionCompanyRow): VisitTourCompanyLike | null {
  if (row.latitude == null || row.longitude == null) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    commercial_status: normalizeCommercialStatus(row.commercial_status),
    latitude: row.latitude,
    longitude: row.longitude,
    import_payload: row.import_payload,
    lastVisitAt: row.last_visit_at,
  };
}

const cachedGetDailyVisitSuggestions = cache(async (
  agentId: string | null
): Promise<{ data: DailyVisitSuggestion[]; error: string | null }> => {
  const supabase = await createServerClient();

  let query = supabase
    .from("companies")
    .select(SUGGESTION_COLUMNS)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .neq("commercial_status", "non_interessato")
    .limit(2500);

  if (agentId) {
    query = applyAgentCompanyScope(query, agentId);
  }

  const [companiesRes, optimizeContext, opportunityMap, productSignals] = await Promise.all([
    query,
    fetchVisitTourOptimizeContext(),
    fetchOpportunityAggregates(),
    fetchProductSignals(),
  ]);

  if (companiesRes.error) {
    return { data: [], error: describeDbError(companiesRes.error) };
  }

  const rows = (companiesRes.data ?? []) as SuggestionCompanyRow[];
  const visitedTodaySet = new Set(optimizeContext.visitedTodayCompanyIds);

  const geocoded = rows
    .map((row) => ({
      row,
      company: mapSuggestionCompany(row),
    }))
    .filter((entry): entry is { row: SuggestionCompanyRow; company: VisitTourCompanyLike } =>
      entry.company !== null
    );

  const referencePoint = computeReferencePoint(
    geocoded.map((entry) => ({
      latitude: entry.company.latitude,
      longitude: entry.company.longitude,
    }))
  );

  const suggestions: DailyVisitSuggestion[] = [];

  for (const { row, company } of geocoded) {
    const exclusion = getVisitTourExclusionReason(company, visitedTodaySet);
    if (exclusion) {
      continue;
    }

    const distanceKm =
      referencePoint != null
        ? getDistanceKm(
            referencePoint.latitude,
            referencePoint.longitude,
            company.latitude,
            company.longitude
          )
        : null;

    const scored = scoreDailyVisitSuggestion({
      company: { ...company, revenue: row.revenue, city: row.city },
      context: optimizeContext,
      distanceKm,
      opportunity: opportunityMap.get(company.id) ?? null,
      hasHighProductInterest: productSignals.highInterestCompanyIds.has(company.id),
      purchasedProductCount: productSignals.purchasedCountByCompany.get(company.id) ?? 0,
    });

    if (scored.score <= 0) {
      continue;
    }

    suggestions.push({
      companyId: company.id,
      companyName: company.name,
      city: row.city,
      province: row.province,
      commercialStatus: company.commercial_status,
      score: scored.score,
      tier: getPriorityTier(scored.score),
      reasons: scored.reasons,
      signals: scored.signals,
    });
  }

  suggestions.sort((left, right) => right.score - left.score);

  return { data: suggestions, error: null };
});

export async function getDailyVisitSuggestions(options?: {
  limit?: number;
  agentId?: string | null;
}): Promise<{ data: DailyVisitSuggestion[]; error: string | null }> {
  const limit = options?.limit ?? 15;
  const user = await getCurrentUser();
  const agentId = options?.agentId ?? user?.id ?? null;

  const result = await cachedGetDailyVisitSuggestions(agentId);
  if (result.error) {
    return result;
  }

  return { data: result.data.slice(0, limit), error: null };
}

export async function listAssistantAgents(): Promise<{
  data: Array<{ id: string; label: string }>;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id,full_name,email")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return {
    data: (data ?? []).map((user) => ({
      id: user.id,
      label: user.full_name?.trim() || user.email,
    })),
    error: null,
  };
}
