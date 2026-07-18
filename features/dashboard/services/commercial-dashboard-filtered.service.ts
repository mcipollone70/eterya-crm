import "server-only";

import type { CommercialDashboardFilters } from "@/lib/constants/dashboard-filters";
import {
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/constants/opportunity-pipeline";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { isProductFamily } from "@/lib/constants/product-catalog";
import { startOfTodayIso, startOfWeekIso, thresholdIsoDaysAgo } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { CommercialStatus } from "@/lib/supabase/types";
import {
  monthKeysInRange,
  resolveDashboardPeriodRange,
  type DashboardPeriodRange,
} from "../utils/dashboard-period";
import type {
  CommercialDashboardData,
  CommercialDashboardKpis,
  DashboardChartPoint,
  ProspectConversionChart,
} from "../types/commercial-dashboard";
import {
  fetchOverdueActivities,
  fetchTodayTours,
  fetchTopOpportunities,
  fetchUpcomingAppointments,
} from "./commercial-dashboard-queries";

type SupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

interface CompanyScope {
  ids: string[] | null;
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function matchesCompanyFilters(
  row: {
    province: string | null;
    commercial_status: CommercialStatus | null;
    assigned_user_id: string | null;
  },
  filters: CommercialDashboardFilters
): boolean {
  if (filters.province && (row.province ?? "").trim() !== filters.province) {
    return false;
  }
  if (filters.commercialStatus && row.commercial_status !== filters.commercialStatus) {
    return false;
  }
  if (filters.agentId && row.assigned_user_id !== filters.agentId) {
    return false;
  }
  return true;
}

async function resolveCompanyScope(
  supabase: SupabaseClient,
  filters: CommercialDashboardFilters
): Promise<CompanyScope> {
  if (!filters.province && !filters.commercialStatus && !filters.agentId) {
    return { ids: null };
  }

  let query = supabase.from("companies").select("id,province,commercial_status,assigned_user_id");

  if (filters.province) {
    query = query.eq("province", filters.province);
  }
  if (filters.commercialStatus) {
    query = query.eq("commercial_status", filters.commercialStatus);
  }
  if (filters.agentId) {
    query = query.eq("assigned_user_id", filters.agentId);
  }

  const { data, error } = await query.limit(10000);
  if (error) {
    throw new Error(describeDbError(error) ?? error.message);
  }

  return { ids: (data ?? []).map((row) => row.id) };
}

function applyCompanyScopeToIds<T extends { in: (col: string, values: string[]) => T }>(
  query: T,
  companyScope: CompanyScope,
  column = "company_id"
): T {
  if (companyScope.ids && companyScope.ids.length === 0) {
    return query.in(column, ["00000000-0000-0000-0000-000000000000"]);
  }
  if (companyScope.ids) {
    return query.in(column, companyScope.ids);
  }
  return query;
}

async function fetchFilteredKpis(
  supabase: SupabaseClient,
  filters: CommercialDashboardFilters,
  companyScope: CompanyScope,
  range: DashboardPeriodRange | null
): Promise<CommercialDashboardKpis> {
  const todayStart = startOfTodayIso();
  const weekStart = startOfWeekIso();
  const threshold90 = thresholdIsoDaysAgo(90);
  const periodStart = range?.startIso ?? weekStart;

  let companiesQuery = supabase.from("companies").select("id", { count: "exact", head: true });
  let prospectsQuery = supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("commercial_status", "prospect");
  let clientsQuery = supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("commercial_status", "cliente");
  let exClientsQuery = supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("commercial_status", "ex_cliente");
  let geocodedQuery = supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .in("geocode_status", ["geocoded", "completed"])
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  let needsReviewQuery = supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("geocode_status", "needs_review");
  let neverVisitedQuery = supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .is("last_visit_at", null);
  let inactiveClientsQuery = supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("commercial_status", "cliente")
    .or(`last_visit_at.is.null,last_visit_at.lt.${threshold90}`);

  if (filters.province) {
    companiesQuery = companiesQuery.eq("province", filters.province);
    prospectsQuery = prospectsQuery.eq("province", filters.province);
    clientsQuery = clientsQuery.eq("province", filters.province);
    exClientsQuery = exClientsQuery.eq("province", filters.province);
    geocodedQuery = geocodedQuery.eq("province", filters.province);
    needsReviewQuery = needsReviewQuery.eq("province", filters.province);
    neverVisitedQuery = neverVisitedQuery.eq("province", filters.province);
    inactiveClientsQuery = inactiveClientsQuery.eq("province", filters.province);
  }
  if (filters.commercialStatus) {
    companiesQuery = companiesQuery.eq("commercial_status", filters.commercialStatus);
    prospectsQuery = prospectsQuery.eq("commercial_status", filters.commercialStatus);
    clientsQuery = clientsQuery.eq("commercial_status", filters.commercialStatus);
    exClientsQuery = exClientsQuery.eq("commercial_status", filters.commercialStatus);
    geocodedQuery = geocodedQuery.eq("commercial_status", filters.commercialStatus);
    needsReviewQuery = needsReviewQuery.eq("commercial_status", filters.commercialStatus);
    neverVisitedQuery = neverVisitedQuery.eq("commercial_status", filters.commercialStatus);
    inactiveClientsQuery = inactiveClientsQuery.eq("commercial_status", filters.commercialStatus);
  }
  if (filters.agentId) {
    companiesQuery = companiesQuery.eq("assigned_user_id", filters.agentId);
    prospectsQuery = prospectsQuery.eq("assigned_user_id", filters.agentId);
    clientsQuery = clientsQuery.eq("assigned_user_id", filters.agentId);
    exClientsQuery = exClientsQuery.eq("assigned_user_id", filters.agentId);
    geocodedQuery = geocodedQuery.eq("assigned_user_id", filters.agentId);
    needsReviewQuery = needsReviewQuery.eq("assigned_user_id", filters.agentId);
    neverVisitedQuery = neverVisitedQuery.eq("assigned_user_id", filters.agentId);
    inactiveClientsQuery = inactiveClientsQuery.eq("assigned_user_id", filters.agentId);
  }

  let visitsTodayQuery = supabase
    .from("visits")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("completed_at", todayStart);
  let visitsWeekQuery = supabase
    .from("visits")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("completed_at", range ? periodStart : weekStart);
  let followUpsTodayQuery = supabase
    .from("follow_ups")
    .select("id", { count: "exact", head: true })
    .in("status", ["todo", "postponed"])
    .gte("scheduled_at", todayStart)
    .lte("scheduled_at", new Date().toISOString());
  let openOpportunitiesQuery = supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .in("stage", [...OPEN_OPPORTUNITY_STAGES]);
  let pipelineQuery = supabase
    .from("opportunities")
    .select("total_amount")
    .in("stage", [...OPEN_OPPORTUNITY_STAGES]);

  if (filters.agentId) {
    visitsTodayQuery = visitsTodayQuery.eq("user_id", filters.agentId);
    visitsWeekQuery = visitsWeekQuery.eq("user_id", filters.agentId);
    followUpsTodayQuery = followUpsTodayQuery.eq("user_id", filters.agentId);
    openOpportunitiesQuery = openOpportunitiesQuery.eq("user_id", filters.agentId);
    pipelineQuery = pipelineQuery.eq("user_id", filters.agentId);
  }

  if (range) {
    visitsWeekQuery = visitsWeekQuery
      .gte("completed_at", range.startIso)
      .lte("completed_at", range.endIso);
    followUpsTodayQuery = followUpsTodayQuery
      .gte("scheduled_at", range.startIso)
      .lte("scheduled_at", range.endIso);
    openOpportunitiesQuery = openOpportunitiesQuery
      .gte("opened_at", range.startIso)
      .lte("opened_at", range.endIso);
    pipelineQuery = pipelineQuery
      .gte("opened_at", range.startIso)
      .lte("opened_at", range.endIso);
  }

  visitsTodayQuery = applyCompanyScopeToIds(visitsTodayQuery, companyScope);
  visitsWeekQuery = applyCompanyScopeToIds(visitsWeekQuery, companyScope);
  followUpsTodayQuery = applyCompanyScopeToIds(followUpsTodayQuery, companyScope);
  openOpportunitiesQuery = applyCompanyScopeToIds(openOpportunitiesQuery, companyScope);
  pipelineQuery = applyCompanyScopeToIds(pipelineQuery, companyScope);

  const [
    companiesRes,
    prospectsRes,
    clientsRes,
    exClientsRes,
    geocodedRes,
    needsReviewRes,
    neverVisitedRes,
    inactiveClientsRes,
    visitsTodayRes,
    visitsWeekRes,
    followUpsTodayRes,
    openOpportunitiesRes,
    pipelineRes,
  ] = await Promise.all([
    companiesQuery,
    prospectsQuery,
    clientsQuery,
    exClientsQuery,
    geocodedQuery,
    needsReviewQuery,
    neverVisitedQuery,
    inactiveClientsQuery,
    visitsTodayQuery,
    visitsWeekQuery,
    followUpsTodayQuery,
    openOpportunitiesQuery,
    pipelineQuery,
  ]);

  const pipelineValue = (pipelineRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount ?? 0),
    0
  );

  return {
    totalCompanies: companiesRes.count ?? 0,
    prospects: prospectsRes.count ?? 0,
    clients: clientsRes.count ?? 0,
    exClients: exClientsRes.count ?? 0,
    geocodedCompanies: geocodedRes.count ?? 0,
    needsReviewCompanies: needsReviewRes.count ?? 0,
    visitsToday: visitsTodayRes.count ?? 0,
    visitsThisWeek: visitsWeekRes.count ?? 0,
    followUpsToday: followUpsTodayRes.count ?? 0,
    openOpportunities: openOpportunitiesRes.count ?? 0,
    pipelineValue,
    neverVisitedCompanies: neverVisitedRes.count ?? 0,
    clientsWithoutVisit90Days: inactiveClientsRes.count ?? 0,
  };
}

async function fetchFilteredProvinceChart(
  supabase: SupabaseClient,
  filters: CommercialDashboardFilters
): Promise<DashboardChartPoint[]> {
  let query = supabase.from("companies").select("province");
  if (filters.province) {
    query = query.eq("province", filters.province);
  }
  if (filters.commercialStatus) {
    query = query.eq("commercial_status", filters.commercialStatus);
  }
  if (filters.agentId) {
    query = query.eq("assigned_user_id", filters.agentId);
  }

  const { data, error } = await query.limit(10000);
  if (error) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const label = (row.province ?? "").trim() || "N/D";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

async function fetchFilteredCommercialStatusChart(
  supabase: SupabaseClient,
  filters: CommercialDashboardFilters
): Promise<DashboardChartPoint[]> {
  let query = supabase.from("companies").select("commercial_status");
  if (filters.province) {
    query = query.eq("province", filters.province);
  }
  if (filters.commercialStatus) {
    query = query.eq("commercial_status", filters.commercialStatus);
  }
  if (filters.agentId) {
    query = query.eq("assigned_user_id", filters.agentId);
  }

  const { data } = await query.limit(10000);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.commercial_status ?? "prospect";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({
      label: COMMERCIAL_STATUS_LABELS[label as CommercialStatus] ?? label,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

async function fetchFilteredVisitsTrend(
  supabase: SupabaseClient,
  filters: CommercialDashboardFilters,
  companyScope: CompanyScope,
  range: DashboardPeriodRange | null
): Promise<DashboardChartPoint[]> {
  const effectiveRange =
    range ??
    ({
      startIso: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString(),
      endIso: new Date().toISOString(),
      label: "12 mesi",
    } satisfies DashboardPeriodRange);

  let query = supabase
    .from("visits")
    .select("completed_at,company_id,user_id")
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .gte("completed_at", effectiveRange.startIso)
    .lte("completed_at", effectiveRange.endIso);

  if (filters.agentId) {
    query = query.eq("user_id", filters.agentId);
  }
  query = applyCompanyScopeToIds(query, companyScope);

  const { data } = await query.limit(10000);
  const monthKeys = monthKeysInRange(effectiveRange);
  const counts = new Map(monthKeys.map((key) => [key, 0]));

  for (const row of data ?? []) {
    if (!row.completed_at) {
      continue;
    }
    const key = row.completed_at.slice(0, 7);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return monthKeys.map((label) => ({ label, value: counts.get(label) ?? 0 }));
}

async function fetchFilteredOpportunityStageChart(
  supabase: SupabaseClient,
  filters: CommercialDashboardFilters,
  companyScope: CompanyScope,
  range: DashboardPeriodRange | null
): Promise<DashboardChartPoint[]> {
  let query = supabase.from("opportunities").select("stage,company_id,user_id,opened_at");
  if (filters.agentId) {
    query = query.eq("user_id", filters.agentId);
  }
  if (range) {
    query = query.gte("opened_at", range.startIso).lte("opened_at", range.endIso);
  }
  query = applyCompanyScopeToIds(query, companyScope);

  const { data } = await query.limit(5000);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const stage = String(row.stage);
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({
      label: OPPORTUNITY_STAGE_LABELS[label as keyof typeof OPPORTUNITY_STAGE_LABELS] ?? label,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

async function fetchFilteredProductInterestsChart(
  supabase: SupabaseClient,
  companyScope: CompanyScope
): Promise<DashboardChartPoint[]> {
  let query = supabase
    .from("company_product_interests")
    .select("company_id,products(family)")
    .eq("relation_type", "interest");

  query = applyCompanyScopeToIds(query, companyScope);
  const { data } = await query.limit(5000);

  const counts = new Map<string, number>();
  for (const rawRow of data ?? []) {
    const row = rawRow as {
      company_id: string | null;
      products: { family: string } | { family: string }[] | null;
    };
    const product = relationOne(row.products);
    if (!product || !isProductFamily(product.family)) {
      continue;
    }
    counts.set(product.family, (counts.get(product.family) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({
      label: PRODUCT_FAMILY_LABELS[label as keyof typeof PRODUCT_FAMILY_LABELS] ?? label,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

async function fetchFilteredProspectConversion(
  supabase: SupabaseClient,
  filters: CommercialDashboardFilters,
  range: DashboardPeriodRange | null
): Promise<ProspectConversionChart> {
  let query = supabase
    .from("companies")
    .select("commercial_status,updated_at,province,assigned_user_id");

  if (filters.province) {
    query = query.eq("province", filters.province);
  }
  if (filters.commercialStatus) {
    query = query.eq("commercial_status", filters.commercialStatus);
  }
  if (filters.agentId) {
    query = query.eq("assigned_user_id", filters.agentId);
  }

  const { data } = await query.limit(10000);
  const rows = data ?? [];

  let prospects = 0;
  let clients = 0;
  const monthly = new Map<string, number>();

  for (const row of rows) {
    if (row.commercial_status === "prospect") {
      prospects += 1;
    }
    if (row.commercial_status === "cliente") {
      clients += 1;
      if (row.updated_at) {
        const inRange =
          !range ||
          (row.updated_at >= range.startIso && row.updated_at <= range.endIso);
        if (inRange) {
          const key = row.updated_at.slice(0, 7);
          monthly.set(key, (monthly.get(key) ?? 0) + 1);
        }
      }
    }
  }

  const monthKeys = range
    ? monthKeysInRange(range)
    : monthKeysInRange({
        startIso: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString(),
        endIso: new Date().toISOString(),
        label: "12 mesi",
      });

  return {
    monthly: monthKeys.map((label) => ({ label, value: monthly.get(label) ?? 0 })),
    conversionRate:
      prospects + clients === 0 ? 0 : Math.round((clients / (prospects + clients)) * 1000) / 10,
    prospects,
    clients,
  };
}

async function fetchFilteredRecentContacts(
  supabase: SupabaseClient,
  filters: CommercialDashboardFilters,
  companyScope: CompanyScope,
  range: DashboardPeriodRange | null
) {
  let query = supabase
    .from("activities")
    .select("id,company_id,type,title,occurred_at,companies(name,province,commercial_status,assigned_user_id)")
    .eq("status", "done")
    .order("occurred_at", { ascending: false })
    .limit(40);

  if (filters.agentId) {
    query = query.eq("user_id", filters.agentId);
  }
  if (range) {
    query = query.gte("occurred_at", range.startIso).lte("occurred_at", range.endIso);
  }

  const { data } = await query;
  type RecentContactRow = {
    id: string;
    company_id: string;
    type: string;
    title: string;
    occurred_at: string;
    companies:
      | {
          name: string;
          province: string | null;
          commercial_status: CommercialStatus | null;
          assigned_user_id: string | null;
        }
      | Array<{
          name: string;
          province: string | null;
          commercial_status: CommercialStatus | null;
          assigned_user_id: string | null;
        }>
      | null;
  };

  return ((data ?? []) as RecentContactRow[])
    .filter((row) => {
      const company = relationOne(row.companies);
      if (!company) {
        return companyScope.ids === null;
      }
      return matchesCompanyFilters(company, filters);
    })
    .slice(0, 8)
    .map((row) => {
      const company = relationOne(row.companies);
      return {
        id: row.id,
        companyId: row.company_id,
        companyName: company?.name ?? null,
        type: row.type,
        title: row.title,
        occurredAt: row.occurred_at,
        href: `/companies/${row.company_id}`,
      };
    });
}

export async function getFilteredCommercialDashboardData(
  filters: CommercialDashboardFilters
): Promise<{ data: CommercialDashboardData | null; error: string | null }> {
  const supabase = await createServerClient();
  const range = resolveDashboardPeriodRange(filters.period);

  try {
    const companyScope = await resolveCompanyScope(supabase, filters);

    const [
      kpis,
      companiesByProvince,
      companiesByCommercialStatus,
      visitsMonthlyTrend,
      opportunitiesByStage,
      productInterests,
      prospectConversion,
      upcomingAppointments,
      overdueActivities,
      recentContacts,
      topOpportunities,
      todayTours,
    ] = await Promise.all([
      fetchFilteredKpis(supabase, filters, companyScope, range),
      fetchFilteredProvinceChart(supabase, filters),
      fetchFilteredCommercialStatusChart(supabase, filters),
      fetchFilteredVisitsTrend(supabase, filters, companyScope, range),
      fetchFilteredOpportunityStageChart(supabase, filters, companyScope, range),
      fetchFilteredProductInterestsChart(supabase, companyScope),
      fetchFilteredProspectConversion(supabase, filters, range),
      fetchUpcomingAppointments(supabase, filters, companyScope),
      fetchOverdueActivities(supabase, filters, companyScope),
      fetchFilteredRecentContacts(supabase, filters, companyScope, range),
      fetchTopOpportunities(supabase, filters, companyScope),
      fetchTodayTours(supabase, filters),
    ]);

    return {
      data: {
        kpis,
        companiesByProvince,
        companiesByCommercialStatus,
        visitsMonthlyTrend,
        opportunitiesByStage,
        productInterests,
        prospectConversion,
        upcomingAppointments,
        overdueActivities,
        recentContacts,
        topOpportunities,
        todayTours,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Errore caricamento dashboard filtrata.",
    };
  }
}
