import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { listRecentContactHistory } from "@/features/activities/services/contact-history.service";
import { getFollowUpEffectiveDate } from "@/lib/constants/follow-up";
import {
  OPPORTUNITY_STAGE_LABELS,
  OPEN_OPPORTUNITY_STAGES,
} from "@/lib/constants/opportunity-pipeline";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { startOfTodayIso } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import {
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  normalizeDashboardLayout,
} from "../constants/dashboard-widgets";
import type {
  CommercialDashboardData,
  CommercialDashboardKpis,
  DashboardAppointmentItem,
  DashboardChartPoint,
  DashboardLayoutState,
  DashboardOpportunityItem,
  DashboardOverdueItem,
  DashboardRecentContactItem,
  DashboardTourItem,
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

async function fetchUpcomingAppointments(
  supabase: Awaited<ReturnType<typeof createServerClient>>
): Promise<DashboardAppointmentItem[]> {
  const nowIso = new Date().toISOString();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [visitsRes, followUpsRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id,company_id,scheduled_at,status,companies(name)")
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_at", nowIso)
      .lte("scheduled_at", nextWeek)
      .order("scheduled_at", { ascending: true })
      .limit(8),
    supabase
      .from("follow_ups")
      .select("id,company_id,activity_type,scheduled_at,postponed_to,status,companies(name)")
      .in("status", ["todo", "postponed"])
      .is("completed_at", null)
      .gte("scheduled_at", nowIso)
      .lte("scheduled_at", nextWeek)
      .order("scheduled_at", { ascending: true })
      .limit(8),
  ]);

  const items: DashboardAppointmentItem[] = [];

  type VisitRow = {
    id: string;
    company_id: string;
    scheduled_at: string;
    companies: { name: string } | { name: string }[] | null;
  };

  type FollowUpRow = {
    id: string;
    company_id: string;
    activity_type: string;
    scheduled_at: string;
    postponed_to: string | null;
    status: "todo" | "postponed" | "completed" | "cancelled";
    companies: { name: string } | { name: string }[] | null;
  };

  for (const visit of (visitsRes.data ?? []) as VisitRow[]) {
    const company = Array.isArray(visit.companies) ? visit.companies[0] : visit.companies;
    items.push({
      id: visit.id,
      kind: "visit",
      title: "Visita pianificata",
      companyId: visit.company_id,
      companyName: company?.name ?? null,
      scheduledAt: visit.scheduled_at,
      href: `/companies/${visit.company_id}`,
    });
  }

  for (const followUp of (followUpsRes.data ?? []) as FollowUpRow[]) {
    const company = Array.isArray(followUp.companies) ? followUp.companies[0] : followUp.companies;
    const effectiveAt = getFollowUpEffectiveDate({
      status: followUp.status,
      scheduled_at: followUp.scheduled_at,
      postponed_to: followUp.postponed_to,
    });
    items.push({
      id: followUp.id,
      kind: "follow_up",
      title: `Follow-up · ${followUp.activity_type}`,
      companyId: followUp.company_id,
      companyName: company?.name ?? null,
      scheduledAt: effectiveAt,
      href: `/activities?section=followups`,
    });
  }

  return items
    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())
    .slice(0, 8);
}

async function fetchOverdueActivities(
  supabase: Awaited<ReturnType<typeof createServerClient>>
): Promise<DashboardOverdueItem[]> {
  const todayStart = startOfTodayIso();
  const items: DashboardOverdueItem[] = [];

  const [followUpsRes, activitiesRes] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("id,company_id,activity_type,scheduled_at,postponed_to,status,companies(name)")
      .in("status", ["todo", "postponed"])
      .is("completed_at", null)
      .order("scheduled_at", { ascending: true })
      .limit(20),
    supabase
      .from("activities")
      .select("id,company_id,title,type,next_follow_up_at,companies(name)")
      .eq("status", "done")
      .not("next_follow_up_at", "is", null)
      .lt("next_follow_up_at", todayStart)
      .order("next_follow_up_at", { ascending: true })
      .limit(20),
  ]);

  type OverdueFollowUpRow = {
    id: string;
    company_id: string;
    activity_type: string;
    scheduled_at: string;
    postponed_to: string | null;
    status: "todo" | "postponed" | "completed" | "cancelled";
    companies: { name: string } | { name: string }[] | null;
  };
  type OverdueActivityRow = {
    id: string;
    company_id: string | null;
    title: string | null;
    type: string;
    next_follow_up_at: string | null;
    companies: { name: string } | { name: string }[] | null;
  };

  for (const followUp of (followUpsRes.data ?? []) as OverdueFollowUpRow[]) {
    const effectiveAt = getFollowUpEffectiveDate({
      status: followUp.status,
      scheduled_at: followUp.scheduled_at,
      postponed_to: followUp.postponed_to,
    });
    if (new Date(effectiveAt).getTime() >= new Date(todayStart).getTime()) {
      continue;
    }
    const company = Array.isArray(followUp.companies) ? followUp.companies[0] : followUp.companies;
    items.push({
      id: followUp.id,
      kind: "follow_up",
      title: `Follow-up · ${followUp.activity_type}`,
      companyId: followUp.company_id,
      companyName: company?.name ?? null,
      dueAt: effectiveAt,
      href: "/activities?section=followups&fperiod=overdue",
    });
  }

  for (const activity of (activitiesRes.data ?? []) as OverdueActivityRow[]) {
    const company = Array.isArray(activity.companies) ? activity.companies[0] : activity.companies;
    items.push({
      id: activity.id,
      kind: "activity",
      title: activity.title ?? activity.type,
      companyId: activity.company_id,
      companyName: company?.name ?? null,
      dueAt: activity.next_follow_up_at!,
      href: activity.company_id ? `/companies/${activity.company_id}` : "/activities",
    });
  }

  return items
    .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime())
    .slice(0, 8);
}

async function fetchTopOpportunities(
  supabase: Awaited<ReturnType<typeof createServerClient>>
): Promise<DashboardOpportunityItem[]> {
  const { data } = await supabase
    .from("opportunities")
    .select("id,company_id,title,stage,total_amount,companies(name)")
    .in("stage", [...OPEN_OPPORTUNITY_STAGES])
    .order("total_amount", { ascending: false })
    .limit(8);

  type OpportunityRow = {
    id: string;
    company_id: string;
    title: string;
    stage: string;
    total_amount: number | null;
    companies: { name: string } | { name: string }[] | null;
  };

  return ((data ?? []) as OpportunityRow[]).map((row) => {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    const stage = String(row.stage);
    return {
      id: row.id,
      title: row.title,
      companyId: row.company_id,
      companyName: company?.name ?? null,
      stage: OPPORTUNITY_STAGE_LABELS[stage as keyof typeof OPPORTUNITY_STAGE_LABELS] ?? stage,
      amount: Number(row.total_amount ?? 0),
      href: `/opportunities`,
    };
  });
}

async function fetchTodayTours(
  supabase: Awaited<ReturnType<typeof createServerClient>>
): Promise<DashboardTourItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("visit_tours")
    .select("id,tour_date,stops,status,estimated_minutes")
    .eq("tour_date", today)
    .order("created_at", { ascending: false })
    .limit(5);

  type TourRow = {
    id: string;
    tour_date: string;
    stops: unknown;
    status: string;
    estimated_minutes: number | null;
  };

  return ((data ?? []) as TourRow[]).map((row) => {
    const stops = Array.isArray(row.stops) ? row.stops : [];
    return {
      id: row.id,
      tourDate: row.tour_date,
      stopsCount: stops.length,
      status: row.status,
      estimatedMinutes: row.estimated_minutes,
      href: "/routes",
    };
  });
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

export async function getCommercialDashboardData(): Promise<{
  data: CommercialDashboardData | null;
  error: string | null;
}> {
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