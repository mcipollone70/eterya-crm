import "server-only";

import type { CommercialDashboardFilters } from "@/lib/constants/dashboard-filters";
import { getFollowUpEffectiveDate, type FollowUpStatus } from "@/lib/constants/follow-up";
import { OPPORTUNITY_STAGE_LABELS, OPEN_OPPORTUNITY_STAGES } from "@/lib/constants/opportunity-pipeline";
import { startOfTodayIso } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import type {
  DashboardAppointmentItem,
  DashboardOpportunityItem,
  DashboardOverdueItem,
  DashboardTourItem,
} from "../types/commercial-dashboard";

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

function applyCompanyScope<T extends { in: (col: string, values: string[]) => T }>(
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

export async function fetchUpcomingAppointments(
  supabase: SupabaseClient,
  filters?: CommercialDashboardFilters,
  companyScope: CompanyScope = { ids: null }
): Promise<DashboardAppointmentItem[]> {
  const nowIso = new Date().toISOString();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let visitsQuery = supabase
    .from("visits")
    .select("id,company_id,scheduled_at,status,user_id,companies(name)")
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_at", nowIso)
    .lte("scheduled_at", nextWeek)
    .order("scheduled_at", { ascending: true })
    .limit(12);

  let followUpsQuery = supabase
    .from("follow_ups")
    .select("id,company_id,activity_type,scheduled_at,postponed_to,status,user_id,companies(name)")
    .in("status", ["todo", "postponed"])
    .is("completed_at", null)
    .gte("scheduled_at", nowIso)
    .lte("scheduled_at", nextWeek)
    .order("scheduled_at", { ascending: true })
    .limit(12);

  if (filters?.agentId) {
    visitsQuery = visitsQuery.eq("user_id", filters.agentId);
    followUpsQuery = followUpsQuery.eq("user_id", filters.agentId);
  }

  visitsQuery = applyCompanyScope(visitsQuery, companyScope);
  followUpsQuery = applyCompanyScope(followUpsQuery, companyScope);

  const [visitsRes, followUpsRes] = await Promise.all([visitsQuery, followUpsQuery]);
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
    status: FollowUpStatus;
    companies: { name: string } | { name: string }[] | null;
  };

  for (const visit of (visitsRes.data ?? []) as VisitRow[]) {
    const company = relationOne(visit.companies);
    items.push({
      id: visit.id,
      kind: "visit",
      title: "Visita pianificata",
      companyId: visit.company_id,
      companyName: company?.name ?? null,
      scheduledAt: visit.scheduled_at,
      href: `/visits?company=${visit.company_id}`,
    });
  }

  for (const followUp of (followUpsRes.data ?? []) as FollowUpRow[]) {
    const company = relationOne(followUp.companies);
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
      href: "/activities?section=followups",
    });
  }

  return items
    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())
    .slice(0, 8);
}

export async function fetchOverdueActivities(
  supabase: SupabaseClient,
  filters?: CommercialDashboardFilters,
  companyScope: CompanyScope = { ids: null }
): Promise<DashboardOverdueItem[]> {
  const todayStart = startOfTodayIso();
  const items: DashboardOverdueItem[] = [];

  let followUpsQuery = supabase
    .from("follow_ups")
    .select("id,company_id,activity_type,scheduled_at,postponed_to,status,user_id,companies(name)")
    .in("status", ["todo", "postponed"])
    .is("completed_at", null)
    .order("scheduled_at", { ascending: true })
    .limit(20);

  let activitiesQuery = supabase
    .from("activities")
    .select("id,company_id,title,type,next_follow_up_at,user_id,companies(name)")
    .eq("status", "done")
    .not("next_follow_up_at", "is", null)
    .lt("next_follow_up_at", todayStart)
    .order("next_follow_up_at", { ascending: true })
    .limit(20);

  if (filters?.agentId) {
    followUpsQuery = followUpsQuery.eq("user_id", filters.agentId);
    activitiesQuery = activitiesQuery.eq("user_id", filters.agentId);
  }

  followUpsQuery = applyCompanyScope(followUpsQuery, companyScope);
  activitiesQuery = applyCompanyScope(activitiesQuery, companyScope);

  const [followUpsRes, activitiesRes] = await Promise.all([followUpsQuery, activitiesQuery]);

  type OverdueFollowUpRow = {
    id: string;
    company_id: string;
    activity_type: string;
    scheduled_at: string;
    postponed_to: string | null;
    status: FollowUpStatus;
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
    const company = relationOne(followUp.companies);
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
    const company = relationOne(activity.companies);
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

export async function fetchTopOpportunities(
  supabase: SupabaseClient,
  filters?: CommercialDashboardFilters,
  companyScope: CompanyScope = { ids: null }
): Promise<DashboardOpportunityItem[]> {
  let query = supabase
    .from("opportunities")
    .select("id,company_id,title,stage,total_amount,user_id,companies(name)")
    .in("stage", [...OPEN_OPPORTUNITY_STAGES])
    .order("total_amount", { ascending: false })
    .limit(12);

  if (filters?.agentId) {
    query = query.eq("user_id", filters.agentId);
  }
  query = applyCompanyScope(query, companyScope);

  const { data } = await query;

  type OpportunityRow = {
    id: string;
    company_id: string;
    title: string;
    stage: string;
    total_amount: number | null;
    companies: { name: string } | { name: string }[] | null;
  };

  return ((data ?? []) as OpportunityRow[]).map((row) => {
    const company = relationOne(row.companies);
    const stage = String(row.stage);
    return {
      id: row.id,
      title: row.title,
      companyId: row.company_id,
      companyName: company?.name ?? null,
      stage: OPPORTUNITY_STAGE_LABELS[stage as keyof typeof OPPORTUNITY_STAGE_LABELS] ?? stage,
      amount: Number(row.total_amount ?? 0),
      href: "/opportunities",
    };
  }).slice(0, 8);
}

export async function fetchTodayTours(
  supabase: SupabaseClient,
  filters?: CommercialDashboardFilters
): Promise<DashboardTourItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("visit_tours")
    .select("id,tour_date,stops,status,estimated_minutes,user_id")
    .eq("tour_date", today)
    .order("created_at", { ascending: false })
    .limit(5);

  if (filters?.agentId) {
    query = query.eq("user_id", filters.agentId);
  }

  const { data } = await query;

  return (data ?? []).map((row) => {
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
