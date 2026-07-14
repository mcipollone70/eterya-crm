import "server-only";

import type { CommercialDashboardFilters } from "@/lib/constants/dashboard-filters";
import { hasActiveDashboardFilters } from "@/lib/constants/dashboard-filters";
import { getCurrentUser } from "@/features/auth/session";
import { listRecentContactHistory } from "@/features/activities/services/contact-history.service";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { OPPORTUNITY_STAGE_LABELS } from "@/lib/constants/opportunity-pipeline";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import {
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  normalizeDashboardLayout,
} from "../constants/dashboard-widgets";
import { getFilteredCommercialDashboardData } from "./commercial-dashboard-filtered.service";
import {
  fetchOverdueActivities,
  fetchTodayTours,
  fetchTopOpportunities,
  fetchUpcomingAppointments,
} from "./commercial-dashboard-queries";
import type {
  CommercialDashboardData,
  CommercialDashboardKpis,
  DashboardChartPoint,
  DashboardLayoutState,
  DashboardRecentContactItem,
  DashboardWidgetId,
  ProspectConversionChart,
} from "../types/commercial-dashboard";

function asChartPoints(value: unknown): DashboardChartPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as { label?: unknown; value?: unknown };
      return {
        label: String(row.label ?? ""),
        value: Number(row.value ?? 0),
      };
    })
    .filter((item): item is DashboardChartPoint => item !== null);
}

function asKpis(value: unknown): CommercialDashboardKpis {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    totalCompanies: Number(row.totalCompanies ?? 0),
    prospects: Number(row.prospects ?? 0),
    clients: Number(row.clients ?? 0),
    exClients: Number(row.exClients ?? 0),
    geocodedCompanies: Number(row.geocodedCompanies ?? 0),
    needsReviewCompanies: Number(row.needsReviewCompanies ?? 0),
    visitsToday: Number(row.visitsToday ?? 0),
    visitsThisWeek: Number(row.visitsThisWeek ?? 0),
    followUpsToday: Number(row.followUpsToday ?? 0),
    openOpportunities: Number(row.openOpportunities ?? 0),
    pipelineValue: Number(row.pipelineValue ?? 0),
    neverVisitedCompanies: Number(row.neverVisitedCompanies ?? 0),
    clientsWithoutVisit90Days: Number(row.clientsWithoutVisit90Days ?? 0),
  };
}

function asProspectConversion(value: unknown): ProspectConversionChart {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    monthly: asChartPoints(row.monthly),
    conversionRate: Number(row.conversionRate ?? 0),
    prospects: Number(row.prospects ?? 0),
    clients: Number(row.clients ?? 0),
  };
}

async function fetchKpisRpc(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data, error } = await supabase.rpc("get_commercial_dashboard_kpis" as never);
  if (error) {
    return { data: null, error: describeDbError(error) };
  }
  return { data: asKpis(data), error: null };
}

async function fetchChartRpc(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  fn: string,
  args?: Record<string, unknown>
) {
  const { data, error } = args
    ? await supabase.rpc(fn as never, args as never)
    : await supabase.rpc(fn as never);
  if (error) {
    return { data: [] as DashboardChartPoint[], error: describeDbError(error) };
  }
  return { data: asChartPoints(data), error: null };
}

async function fetchProspectConversionRpc(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data, error } = await supabase.rpc("get_prospect_conversion_chart" as never);
  if (error) {
    return { data: null, error: describeDbError(error) };
  }
  return { data: asProspectConversion(data), error: null };
}

export async function getDashboardFilterOptions(): Promise<{
  data: { agents: Array<{ id: string; label: string }>; provinces: string[] };
  error: string | null;
}> {
  const supabase = await createServerClient();

  const [usersRes, provinceRes] = await Promise.all([
    supabase
      .from("users")
      .select("id,full_name,email")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase.rpc("get_companies_by_province_chart" as never, { p_limit: 50 } as never),
  ]);

  if (usersRes.error) {
    return { data: { agents: [], provinces: [] }, error: describeDbError(usersRes.error) };
  }

  const agents = (usersRes.data ?? []).map((user) => ({
    id: user.id,
    label: user.full_name?.trim() || user.email,
  }));

  const provincePoints = Array.isArray(provinceRes.data)
    ? (provinceRes.data as Array<{ label?: string }>)
    : [];
  const provinces = provincePoints
    .map((point) => String(point.label ?? "").trim())
    .filter((label) => label && label !== "N/D");

  return { data: { agents, provinces }, error: null };
}

function labelizeCommercialStatusChart(points: DashboardChartPoint[]): DashboardChartPoint[] {
  return points.map((point) => ({
    label: COMMERCIAL_STATUS_LABELS[point.label as keyof typeof COMMERCIAL_STATUS_LABELS] ?? point.label,
    value: point.value,
  }));
}

function labelizeProductChart(points: DashboardChartPoint[]): DashboardChartPoint[] {
  return points.map((point) => ({
    label: PRODUCT_FAMILY_LABELS[point.label as keyof typeof PRODUCT_FAMILY_LABELS] ?? point.label,
    value: point.value,
  }));
}

function labelizeOpportunityStageChart(points: DashboardChartPoint[]): DashboardChartPoint[] {
  return points.map((point) => ({
    label: OPPORTUNITY_STAGE_LABELS[point.label as keyof typeof OPPORTUNITY_STAGE_LABELS] ?? point.label,
    value: point.value,
  }));
}

export async function getCommercialDashboardData(
  filters?: CommercialDashboardFilters
): Promise<{
  data: CommercialDashboardData | null;
  error: string | null;
}> {
  if (filters && hasActiveDashboardFilters(filters)) {
    return getFilteredCommercialDashboardData(filters);
  }

  const supabase = await createServerClient();

  const [
    kpisRes,
    provinceRes,
    statusRes,
    visitsTrendRes,
    opportunityStageRes,
    productInterestsRes,
    conversionRes,
    upcomingAppointments,
    overdueActivities,
    recentContactsRes,
    topOpportunities,
    todayTours,
  ] = await Promise.all([
    fetchKpisRpc(supabase),
    fetchChartRpc(supabase, "get_companies_by_province_chart", { p_limit: 12 }),
    fetchChartRpc(supabase, "get_companies_by_commercial_status_chart"),
    fetchChartRpc(supabase, "get_visits_monthly_trend_chart"),
    fetchChartRpc(supabase, "get_opportunities_by_stage_chart"),
    fetchChartRpc(supabase, "get_product_interests_chart"),
    fetchProspectConversionRpc(supabase),
    fetchUpcomingAppointments(supabase),
    fetchOverdueActivities(supabase),
    listRecentContactHistory(8),
    fetchTopOpportunities(supabase),
    fetchTodayTours(supabase),
  ]);

  const firstError =
    kpisRes.error ??
    provinceRes.error ??
    statusRes.error ??
    visitsTrendRes.error ??
    opportunityStageRes.error ??
    productInterestsRes.error ??
    conversionRes.error ??
    recentContactsRes.error;

  if (firstError || !kpisRes.data || !conversionRes.data) {
    return { data: null, error: firstError ?? "Dati dashboard non disponibili." };
  }

  const recentContacts: DashboardRecentContactItem[] = recentContactsRes.data.map((item) => ({
    id: item.id,
    companyId: item.company_id,
    companyName: item.company_name,
    type: item.type,
    title: item.title,
    occurredAt: item.occurred_at,
    href: `/companies/${item.company_id}`,
  }));

  return {
    data: {
      kpis: kpisRes.data,
      companiesByProvince: provinceRes.data,
      companiesByCommercialStatus: labelizeCommercialStatusChart(statusRes.data),
      visitsMonthlyTrend: visitsTrendRes.data,
      opportunitiesByStage: labelizeOpportunityStageChart(opportunityStageRes.data),
      productInterests: labelizeProductChart(productInterestsRes.data),
      prospectConversion: conversionRes.data,
      upcomingAppointments,
      overdueActivities,
      recentContacts,
      topOpportunities,
      todayTours,
    },
    error: null,
  };
}

export async function getUserDashboardLayout(): Promise<{
  data: DashboardLayoutState;
  error: string | null;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      data: {
        widgetOrder: DEFAULT_DASHBOARD_WIDGET_ORDER,
        hiddenWidgets: [],
      },
      error: null,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("dashboard_layouts")
    .select("widget_order,hidden_widgets")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return {
      data: {
        widgetOrder: DEFAULT_DASHBOARD_WIDGET_ORDER,
        hiddenWidgets: [],
      },
      error: describeDbError(error),
    };
  }

  const normalized = normalizeDashboardLayout(data?.widget_order, data?.hidden_widgets);
  return { data: normalized, error: null };
}

export async function saveUserDashboardLayout(input: {
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
}): Promise<{ success: boolean; message: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "Sessione non valida." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("dashboard_layouts").upsert(
    {
      user_id: user.id,
      widget_order: input.widgetOrder,
      hidden_widgets: input.hiddenWidgets,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Salvataggio layout non riuscito." };
  }

  return { success: true, message: "Layout dashboard salvato." };
}