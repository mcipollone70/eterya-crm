import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { saveContactHistoryActivity } from "@/features/activities/services/contact-history.service";
import type { VisitPeriod } from "@/lib/constants/visit-workflow";
import {
  endOfTodayIso,
  startOfTodayIso,
  startOfWeekIso,
  thresholdIsoDaysAgo,
} from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { Tables, VisitStatus } from "@/lib/supabase/types";

export type Visit = Tables<"visits">;

export interface VisitListItem {
  id: string;
  company_id: string;
  company_name: string | null;
  company_city: string | null;
  company_province: string | null;
  scheduled_at: string;
  completed_at: string | null;
  status: VisitStatus;
  outcome: string | null;
  notes: string | null;
  duration_minutes: number | null;
  next_callback_at: string | null;
  created_at: string;
}

export interface SaveVisitInput {
  companyId: string;
  completedAt: string;
  outcome: string | null;
  notes: string | null;
  durationMinutes: number | null;
  nextCallbackAt: string | null;
}

export interface ScheduleVisitInput {
  companyId: string;
  scheduledAt: string;
  notes?: string | null;
}

export interface CompleteScheduledVisitInput {
  completedAt: string;
  outcome: string | null;
  notes: string | null;
  durationMinutes: number | null;
  nextCallbackAt: string | null;
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
}

export interface ListVisitsFilters {
  period?: VisitPeriod | null;
  companyId?: string;
  limit?: number;
}

export interface VisitCompanyOption {
  id: string;
  name: string;
  city: string | null;
}

export interface VisitDashboardMetrics {
  visitsToday: number;
  visitsThisWeek: number;
  neverVisitedCompanies: number;
  clientsWithoutVisit90Days: number;
}

const VISIT_LIST_SELECT =
  "id,company_id,scheduled_at,completed_at,status,outcome,notes,duration_minutes,next_callback_at,created_at,companies(name,city,province)";

type VisitListRow = {
  id: string;
  company_id: string;
  scheduled_at: string;
  completed_at: string | null;
  status: VisitStatus;
  outcome: string | null;
  notes: string | null;
  duration_minutes: number | null;
  next_callback_at: string | null;
  created_at: string;
  companies: { name: string; city: string | null; province: string | null } | Array<{
    name: string;
    city: string | null;
    province: string | null;
  }> | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapVisitListRow(row: VisitListRow): VisitListItem {
  const company = relationOne(row.companies);

  return {
    id: row.id,
    company_id: row.company_id,
    company_name: company?.name ?? null,
    company_city: company?.city ?? null,
    company_province: company?.province ?? null,
    scheduled_at: row.scheduled_at,
    completed_at: row.completed_at,
    status: row.status,
    outcome: row.outcome,
    notes: row.notes,
    duration_minutes: row.duration_minutes,
    next_callback_at: row.next_callback_at,
    created_at: row.created_at,
  };
}

function matchesVisitPeriod(item: VisitListItem, period: VisitPeriod): boolean {
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();
  const weekStart = startOfWeekIso();

  switch (period) {
    case "today": {
      if (item.status === "completed" && item.completed_at) {
        return item.completed_at >= todayStart && item.completed_at <= todayEnd;
      }
      if (item.status === "scheduled" || item.status === "in_progress") {
        return item.scheduled_at >= todayStart && item.scheduled_at <= todayEnd;
      }
      return false;
    }
    case "overdue":
      return item.status === "scheduled" && item.scheduled_at < todayStart;
    case "upcoming":
      return item.status === "scheduled" && item.scheduled_at > todayEnd;
    case "week": {
      if (item.status === "completed" && item.completed_at) {
        return item.completed_at >= weekStart && item.completed_at <= todayEnd;
      }
      if (item.status === "scheduled" || item.status === "in_progress") {
        return item.scheduled_at >= weekStart && item.scheduled_at <= todayEnd;
      }
      return false;
    }
    case "completed":
      return item.status === "completed";
  }
}

async function resolveVisitUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function syncCompanyLastVisit(companyId: string): Promise<{ error: string | null }> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("visits")
    .select("completed_at,outcome,notes,duration_minutes,next_callback_at")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { error: describeDbError(error) };
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({
      last_visit_at: data?.completed_at ?? null,
      last_visit_outcome: data?.outcome ?? null,
      last_visit_notes: data?.notes ?? null,
      last_visit_duration_minutes: data?.duration_minutes ?? null,
      next_callback_at: data?.next_callback_at ?? null,
    })
    .eq("id", companyId);

  return { error: describeDbError(updateError) };
}

async function finalizeCompletedVisit(
  visitId: string,
  companyId: string,
  input: CompleteScheduledVisitInput
): Promise<{ error: string | null }> {
  const syncResult = await syncCompanyLastVisit(companyId);
  if (syncResult.error) {
    return syncResult;
  }

  const historyResult = await saveContactHistoryActivity({
    companyId,
    type: "visit",
    title: "Visita",
    description: input.notes,
    outcome: input.outcome,
    occurredAt: input.completedAt,
    nextFollowUpAt: input.nextCallbackAt,
    visitId,
    source: "visit",
  });

  return { error: historyResult.error };
}

export async function saveCompletedVisit(
  input: SaveVisitInput
): Promise<{ visitId: string | null; error: string | null }> {
  const userId = await resolveVisitUserId();
  if (!userId) {
    return { visitId: null, error: "Utente non autenticato. Accedi per registrare una visita." };
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("visits")
    .insert({
      company_id: input.companyId,
      user_id: userId,
      scheduled_at: input.completedAt,
      completed_at: input.completedAt,
      status: "completed",
      outcome: input.outcome,
      notes: input.notes,
      duration_minutes: input.durationMinutes,
      next_callback_at: input.nextCallbackAt,
    })
    .select("id")
    .single();

  if (error) {
    return { visitId: null, error: describeDbError(error) };
  }

  const finalizeResult = await finalizeCompletedVisit(data.id, input.companyId, {
    completedAt: input.completedAt,
    outcome: input.outcome,
    notes: input.notes,
    durationMinutes: input.durationMinutes,
    nextCallbackAt: input.nextCallbackAt,
  });

  if (finalizeResult.error) {
    return { visitId: data.id, error: finalizeResult.error };
  }

  return { visitId: data.id, error: null };
}

export async function scheduleVisit(
  input: ScheduleVisitInput
): Promise<{ visitId: string | null; error: string | null }> {
  const userId = await resolveVisitUserId();
  if (!userId) {
    return { visitId: null, error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("visits")
    .insert({
      company_id: input.companyId,
      user_id: userId,
      scheduled_at: input.scheduledAt,
      status: "scheduled",
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return { visitId: null, error: describeDbError(error) };
  }

  return { visitId: data.id, error: null };
}

export async function completeScheduledVisit(
  visitId: string,
  input: CompleteScheduledVisitInput
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();

  const { data: visit, error: fetchError } = await supabase
    .from("visits")
    .select("id,company_id,status")
    .eq("id", visitId)
    .maybeSingle();

  if (fetchError) {
    return { error: describeDbError(fetchError) };
  }

  if (!visit) {
    return { error: "Visita non trovata." };
  }

  if (visit.status === "completed") {
    return { error: "Visita già completata." };
  }

  if (visit.status === "cancelled") {
    return { error: "Visita annullata." };
  }

  const { error: updateError } = await supabase
    .from("visits")
    .update({
      status: "completed",
      completed_at: input.completedAt,
      outcome: input.outcome,
      notes: input.notes,
      duration_minutes: input.durationMinutes,
      next_callback_at: input.nextCallbackAt,
      check_in_latitude: input.checkInLatitude ?? null,
      check_in_longitude: input.checkInLongitude ?? null,
    })
    .eq("id", visitId);

  if (updateError) {
    return { error: describeDbError(updateError) };
  }

  return finalizeCompletedVisit(visitId, visit.company_id, input);
}

export async function listVisits(
  filters: ListVisitsFilters = {}
): Promise<{ data: VisitListItem[]; error: string | null }> {
  const supabase = await createServerClient();
  const period = filters.period ?? "today";
  const limit = filters.limit ?? 200;

  let query = supabase.from("visits").select(VISIT_LIST_SELECT);

  if (filters.companyId) {
    query = query.eq("company_id", filters.companyId);
  }

  if (period === "completed") {
    query = query
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(limit);
  } else if (period === "overdue") {
    query = query
      .eq("status", "scheduled")
      .lt("scheduled_at", startOfTodayIso())
      .order("scheduled_at", { ascending: true })
      .limit(limit);
  } else if (period === "upcoming") {
    query = query
      .eq("status", "scheduled")
      .gt("scheduled_at", endOfTodayIso())
      .order("scheduled_at", { ascending: true })
      .limit(limit);
  } else {
    query = query
      .in("status", ["scheduled", "in_progress", "completed"])
      .order("scheduled_at", { ascending: true })
      .limit(Math.max(limit, 300));
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  let items = (data ?? [])
    .map((row) => mapVisitListRow(row as VisitListRow))
    .filter((item) => matchesVisitPeriod(item, period));

  if (period === "today" || period === "week") {
    items.sort((a, b) => {
      const aOpen = a.status === "scheduled" || a.status === "in_progress";
      const bOpen = b.status === "scheduled" || b.status === "in_progress";
      if (aOpen !== bOpen) {
        return aOpen ? -1 : 1;
      }
      const aDate = aOpen ? a.scheduled_at : (a.completed_at ?? a.scheduled_at);
      const bDate = bOpen ? b.scheduled_at : (b.completed_at ?? b.scheduled_at);
      return aDate.localeCompare(bDate);
    });
  }

  return { data: items.slice(0, limit), error: null };
}

export async function listVisitsByCompany(companyId: string): Promise<{
  data: VisitListItem[];
  error: string | null;
}> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("visits")
    .select(VISIT_LIST_SELECT)
    .eq("company_id", companyId)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("scheduled_at", { ascending: false });

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return {
    data: (data ?? []).map((row) => mapVisitListRow(row as VisitListRow)),
    error: null,
  };
}

export async function listVisitCompanyOptions(): Promise<{
  data: VisitCompanyOption[];
  error: string | null;
}> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id,name,city")
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
    })),
    error: null,
  };
}

export async function getVisitDashboardMetrics(): Promise<{
  data: VisitDashboardMetrics | null;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();
  const weekStart = startOfWeekIso();
  const threshold90 = thresholdIsoDaysAgo(90);

  const [visitsTodayRes, visitsWeekRes, neverVisitedRes, inactiveClientsRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", todayStart),
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", weekStart),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .is("last_visit_at", null),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("commercial_status", "cliente")
      .or(`last_visit_at.is.null,last_visit_at.lt.${threshold90}`),
  ]);

  const failed =
    visitsTodayRes.error ??
    visitsWeekRes.error ??
    neverVisitedRes.error ??
    inactiveClientsRes.error;

  if (failed) {
    return { data: null, error: describeDbError(failed) };
  }

  return {
    data: {
      visitsToday: visitsTodayRes.count ?? 0,
      visitsThisWeek: visitsWeekRes.count ?? 0,
      neverVisitedCompanies: neverVisitedRes.count ?? 0,
      clientsWithoutVisit90Days: inactiveClientsRes.count ?? 0,
    },
    error: null,
  };
}

export async function countNeverVisitedCompanies(): Promise<number> {
  const result = await getVisitDashboardMetrics();
  return result.data?.neverVisitedCompanies ?? 0;
}
