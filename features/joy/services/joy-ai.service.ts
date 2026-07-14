import "server-only";

import { getCurrentUser, getCurrentUserProfile } from "@/features/auth/session";
import { listFollowUps, getFollowUpDashboardMetrics } from "@/features/activities/services/follow-ups.service";
import { getDailyVisitSuggestions } from "@/features/assistant/services/assistant-suggestions.service";
import { getPriorityDashboardMetrics } from "@/features/companies/services/commercial-priority.service";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { getUserScopedTodayVisitPlan } from "@/features/dashboard/services/mission-control.service";
import { listAgendaItems } from "@/features/agenda/services/agenda.service";
import { getOpportunityDashboardMetrics, listOpportunities } from "@/features/opportunities/services/opportunities.service";
import { resolveCompanyIdsForProductFilters } from "@/features/products/services/company-product-interests.service";
import { analyzeOpportunityRadar } from "@/features/radar/services/opportunity-radar.service";
import { listVisits, getVisitDashboardMetrics } from "@/features/visits/services/visits.service";
import { describeDbError } from "@/lib/supabase/errors";
import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import { parseAgendaFilters } from "@/lib/constants/agenda";
import type { ProductFamily } from "@/lib/constants/product-catalog";
import { endOfTodayIso, startOfTodayIso } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import type { JoyData } from "../types/joy-data";
import {
  buildJoyOpportunities,
  buildJoyRecommendations,
  buildJoyRisks,
} from "../utils/build-joy-insights";

function formatItalianDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function resolveDisplayName(fullName: string | null | undefined, email: string | null | undefined): string {
  if (fullName?.trim()) {
    return fullName.trim();
  }
  if (email?.trim()) {
    return email.split("@")[0] ?? "Agente";
  }
  return "Agente";
}

async function estimateTodayTourKm(userId: string | null): Promise<number> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();

  let query = supabase
    .from("visits")
    .select("scheduled_at,companies(latitude,longitude)")
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_at", todayStart)
    .lte("scheduled_at", todayEnd)
    .order("scheduled_at", { ascending: true });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return 0;
  }

  type VisitTourRow = {
    companies:
      | { latitude: number | null; longitude: number | null }
      | Array<{ latitude: number | null; longitude: number | null }>
      | null;
  };

  const points: Array<{ lat: number; lng: number }> = [];
  for (const row of data as VisitTourRow[]) {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    if (company?.latitude != null && company?.longitude != null) {
      points.push({ lat: company.latitude, lng: company.longitude });
    }
  }

  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += getDistanceKm(
      points[index - 1].lat,
      points[index - 1].lng,
      points[index].lat,
      points[index].lng
    );
  }

  return Math.round(total * 10) / 10;
}

export async function countUserVisitsToday(userId: string | null): Promise<number> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();

  let query = supabase
    .from("visits")
    .select("id", { count: "exact", head: true })
    .or(
      `and(status.in.(scheduled,in_progress),scheduled_at.gte.${todayStart},scheduled_at.lte.${todayEnd}),and(status.eq.completed,completed_at.gte.${todayStart},completed_at.lte.${todayEnd})`
    );

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(describeDbError(error) ?? "Conteggio visite non riuscito.");
  }

  return count ?? 0;
}

export async function countUserCompletedVisitsToday(userId: string | null): Promise<number> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();

  let query = supabase
    .from("visits")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("completed_at", todayStart)
    .lte("completed_at", todayEnd);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { count, error } = await query;
  if (error) {
    return 0;
  }

  return count ?? 0;
}

async function fetchCompaniesByProductFamily(
  family: ProductFamily,
  limit = 12
): Promise<Array<{ id: string; name: string; city: string | null }>> {
  const { companyIds } = await resolveCompanyIdsForProductFilters({ productFamily: family });
  if (!companyIds || companyIds.length === 0) {
    return [];
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("companies")
    .select("id,name,city")
    .in("id", companyIds.slice(0, limit))
    .order("name", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
  }));
}

async function getRadarCount(userId: string | null): Promise<number> {
  const supabase = await createServerClient();
  let query = supabase
    .from("companies")
    .select("id,latitude,longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .in("commercial_status", ["prospect", "cliente"])
    .limit(250);

  if (userId) {
    query = applyAgentCompanyScope(query, userId);
  }

  const { data } = await query;
  const companies = data ?? [];
  if (companies.length === 0) {
    return 0;
  }

  const centerLat =
    companies.reduce((sum, row) => sum + Number(row.latitude), 0) / companies.length;
  const centerLng =
    companies.reduce((sum, row) => sum + Number(row.longitude), 0) / companies.length;

  const result = await analyzeOpportunityRadar({
    centerLat,
    centerLng,
    radiusKm: 10,
    companyIds: companies.map((row) => row.id),
  });

  return result.items.length;
}

export async function getJoyData(): Promise<JoyData> {
  const now = new Date();
  const user = await getCurrentUser();
  const profile = await getCurrentUserProfile();
  const userId = user?.id ?? null;
  const userName = resolveDisplayName(profile?.fullName, profile?.email ?? user?.email);

  try {
    const [
      suggestionsResult,
      userDayPlan,
      visitsToday,
      overdueVisitsResult,
      agendaResult,
      overdueFollowUpsResult,
      opportunitiesResult,
      followUpMetrics,
      visitMetrics,
      priorityMetrics,
      opportunityMetrics,
      estimatedTourKm,
      radarHits,
      vepaCompanies,
      zanzariereCompanies,
      tapparelleCompanies,
    ] = await Promise.all([
      getDailyVisitSuggestions({ limit: 20, agentId: userId }),
      getUserScopedTodayVisitPlan(userId),
      countUserVisitsToday(userId),
      listVisits({ period: "overdue", limit: 20 }),
      listAgendaItems(
        parseAgendaFilters({
          view: "day",
          date: now.toISOString().slice(0, 10),
          agent: userId ?? undefined,
          status: "open",
        })
      ),
      listFollowUps({ period: "overdue", limit: 20 }),
      listOpportunities({ limit: 500 }),
      getFollowUpDashboardMetrics(),
      getVisitDashboardMetrics(),
      getPriorityDashboardMetrics(),
      getOpportunityDashboardMetrics(),
      estimateTodayTourKm(userId),
      getRadarCount(userId),
      fetchCompaniesByProductFamily("vepa"),
      fetchCompaniesByProductFamily("zanzariere"),
      fetchCompaniesByProductFamily("tapparelle"),
    ]);

    const suggestions = suggestionsResult.data ?? [];
    const dayPlan = userDayPlan;
    const risks = buildJoyRisks({
      overdueFollowUps: overdueFollowUpsResult.data ?? [],
      opportunities: opportunitiesResult.data ?? [],
      suggestions,
      overdueVisits: overdueVisitsResult.data ?? [],
    });
    const opportunities = buildJoyOpportunities({
      suggestions,
      productFamilyCompanies: {
        vepa: vepaCompanies,
        zanzariere: zanzariereCompanies,
        tapparelle: tapparelleCompanies,
      },
    });
    const recommendations = buildJoyRecommendations(suggestions);

    const agendaItems = (agendaResult.data ?? []).filter(
      (item) => new Date(item.scheduledAt).getTime() >= now.getTime()
    );

    const errors = [
      suggestionsResult.error,
      agendaResult.error,
      overdueFollowUpsResult.error,
      opportunitiesResult.error,
      followUpMetrics.error,
      visitMetrics.error,
      priorityMetrics.error,
      opportunityMetrics.error,
    ].filter(Boolean);

    return {
      userName,
      dateLabel: formatItalianDate(now),
      summary: {
        visitsToday,
        agendaItems: agendaItems.length,
        overdueFollowUps: followUpMetrics.data?.overdue ?? 0,
        openOpportunities: opportunityMetrics.data?.openCount ?? 0,
        radarHits,
        estimatedTourKm,
        neverVisitedCompanies: visitMetrics.data?.neverVisitedCompanies ?? 0,
        inactiveClients: priorityMetrics.data?.inactiveClients90Days ?? 0,
        pipelineValue: opportunityMetrics.data?.pipelineValue ?? 0,
      },
      recommendations,
      risks,
      opportunities,
      dayPlan,
      suggestions,
      error: errors[0] ?? null,
    };
  } catch (error) {
    return {
      userName,
      dateLabel: formatItalianDate(now),
      summary: {
        visitsToday: 0,
        agendaItems: 0,
        overdueFollowUps: 0,
        openOpportunities: 0,
        radarHits: 0,
        estimatedTourKm: 0,
        neverVisitedCompanies: 0,
        inactiveClients: 0,
        pipelineValue: 0,
      },
      recommendations: [],
      risks: [],
      opportunities: [],
      dayPlan: [],
      suggestions: [],
      error: error instanceof Error ? error.message : "Impossibile caricare Joy AI.",
    };
  }
}
