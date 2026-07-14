import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { syncCompanyLastVisit } from "@/features/visits/services/visits.service";
import {
  CONTACT_HISTORY_TYPES,
  getDefaultContactHistoryTitle,
  isContactHistoryType,
  type ContactHistoryType,
} from "@/lib/constants/contact-history";
import {
  buildContactHistoryMetadata,
  countAttachmentStubs,
  type ContactHistoryAttachmentStub,
} from "@/lib/contact-history/metadata";
import { startOfTodayIso, startOfWeekIso } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { ActivityStatus, Json } from "@/lib/supabase/types";

export interface ContactHistoryItem {
  id: string;
  company_id: string;
  company_name: string | null;
  user_id: string;
  visit_id: string | null;
  type: ContactHistoryType;
  title: string;
  description: string | null;
  outcome: string | null;
  occurred_at: string;
  next_follow_up_at: string | null;
  operator_name: string | null;
  operator_email: string | null;
  attachment_count: number;
  metadata: Json;
  created_at: string;
}

export interface SaveContactHistoryInput {
  companyId: string;
  type: ContactHistoryType;
  title?: string;
  description?: string | null;
  outcome?: string | null;
  occurredAt?: string;
  nextFollowUpAt?: string | null;
  visitId?: string | null;
  attachments?: ContactHistoryAttachmentStub[];
  source?: "manual" | "visit";
}

export interface ListContactHistoryFilters {
  companyId?: string;
  type?: ContactHistoryType | null;
  operatorId?: string | null;
  period?: "today" | "week" | "month" | "quarter" | null;
  search?: string | null;
  limit?: number;
}

export interface ContactHistoryDashboardMetrics {
  activitiesToday: number;
  activitiesThisWeek: number;
  overdueActivities: number;
}

export interface OperatorOption {
  id: string;
  label: string;
}

const HISTORY_SELECT =
  "id,company_id,user_id,visit_id,type,title,description,outcome,occurred_at,next_follow_up_at,metadata,created_at,companies(name),users(full_name,email)";

type HistoryRow = {
  id: string;
  company_id: string | null;
  user_id: string;
  visit_id: string | null;
  type: string;
  title: string;
  description: string | null;
  outcome: string | null;
  occurred_at: string | null;
  next_follow_up_at: string | null;
  metadata: Json;
  created_at: string;
  companies: { name: string } | { name: string }[] | null;
  users: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
};

async function resolveActivityUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapHistoryRow(row: HistoryRow): ContactHistoryItem | null {
  if (!row.company_id || !isContactHistoryType(row.type) || !row.occurred_at) {
    return null;
  }

  const company = relationOne(row.companies);
  const operator = relationOne(row.users);

  return {
    id: row.id,
    company_id: row.company_id,
    company_name: company?.name ?? null,
    user_id: row.user_id,
    visit_id: row.visit_id,
    type: row.type,
    title: row.title,
    description: row.description,
    outcome: row.outcome,
    occurred_at: row.occurred_at,
    next_follow_up_at: row.next_follow_up_at,
    operator_name: operator?.full_name ?? operator?.email ?? null,
    operator_email: operator?.email ?? null,
    attachment_count: countAttachmentStubs(row.metadata),
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

function periodStart(period: NonNullable<ListContactHistoryFilters["period"]>): string {
  const now = new Date();

  switch (period) {
    case "today":
      return startOfTodayIso();
    case "week":
      return startOfWeekIso();
    case "month": {
      const date = new Date(now);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date.toISOString();
    }
    case "quarter": {
      const date = new Date(now);
      date.setMonth(date.getMonth() - 3);
      date.setHours(0, 0, 0, 0);
      return date.toISOString();
    }
  }
}

function applyHistoryFilters<T extends {
  eq: (col: string, val: string) => T;
  in: (col: string, vals: string[]) => T;
  gte: (col: string, val: string) => T;
  or: (filters: string) => T;
}>(query: T, filters: ListContactHistoryFilters): T {
  let next = query.in("type", [...CONTACT_HISTORY_TYPES]).eq("status", "done");

  if (filters.companyId) {
    next = next.eq("company_id", filters.companyId);
  }

  if (filters.type) {
    next = next.eq("type", filters.type);
  }

  if (filters.operatorId) {
    next = next.eq("user_id", filters.operatorId);
  }

  if (filters.period) {
    next = next.gte("occurred_at", periodStart(filters.period));
  }

  const search = filters.search?.trim();
  if (search) {
    const escaped = search.replace(/[%_,]/g, " ");
    next = next.or(
      `title.ilike.%${escaped}%,description.ilike.%${escaped}%,outcome.ilike.%${escaped}%`
    );
  }

  return next;
}

export async function syncCompanyLastContact(companyId: string): Promise<{ error: string | null }> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("activities")
    .select("occurred_at,type,outcome")
    .eq("company_id", companyId)
    .eq("status", "done")
    .in("type", [...CONTACT_HISTORY_TYPES])
    .not("occurred_at", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { error: describeDbError(error) };
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({
      last_contact_at: data?.occurred_at ?? null,
      last_contact_type: data?.type ?? null,
      last_contact_outcome: data?.outcome ?? null,
    })
    .eq("id", companyId);

  return { error: describeDbError(updateError) };
}

async function syncCompanyFromActivity(
  companyId: string,
  type: ContactHistoryType
): Promise<{ error: string | null }> {
  const contactResult = await syncCompanyLastContact(companyId);
  if (contactResult.error) {
    return contactResult;
  }

  if (type === "visit") {
    return syncCompanyLastVisit(companyId);
  }

  return { error: null };
}

export async function saveContactHistoryActivity(
  input: SaveContactHistoryInput
): Promise<{ activityId: string | null; error: string | null }> {
  const userId = await resolveActivityUserId();
  if (!userId) {
    return {
      activityId: null,
      error: "Utente non autenticato. Accedi per registrare un'attività.",
    };
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const metadata = buildContactHistoryMetadata({
    attachments: input.attachments ?? [],
    source: input.source ?? "manual",
  });

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("activities")
    .insert({
      company_id: input.companyId,
      user_id: userId,
      visit_id: input.visitId ?? null,
      type: input.type,
      title: input.title?.trim() || getDefaultContactHistoryTitle(input.type),
      description: input.description?.trim() || null,
      outcome: input.outcome?.trim() || null,
      status: "done" as ActivityStatus,
      completed_at: occurredAt,
      occurred_at: occurredAt,
      next_follow_up_at: input.nextFollowUpAt ?? null,
      metadata: metadata as Json,
    })
    .select("id")
    .single();

  if (error) {
    return { activityId: null, error: describeDbError(error) };
  }

  const syncResult = await syncCompanyFromActivity(input.companyId, input.type);
  if (syncResult.error) {
    return { activityId: data.id, error: syncResult.error };
  }

  return { activityId: data.id, error: null };
}

export async function listContactHistory(
  filters: ListContactHistoryFilters = {}
): Promise<{ data: ContactHistoryItem[]; error: string | null }> {
  const supabase = await createServerClient();
  const limit = filters.limit ?? 200;

  let query = supabase
    .from("activities")
    .select(HISTORY_SELECT)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  query = applyHistoryFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  const items = (data ?? [])
    .map((row) => mapHistoryRow(row as HistoryRow))
    .filter((item): item is ContactHistoryItem => item !== null);

  return { data: items, error: null };
}

export async function listContactHistoryOperators(): Promise<{
  data: OperatorOption[];
  error: string | null;
}> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("activities")
    .select("user_id,users(full_name,email)")
    .in("type", [...CONTACT_HISTORY_TYPES])
    .eq("status", "done");

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  const operators = new Map<string, string>();

  for (const row of data ?? []) {
    const userId = (row as { user_id: string }).user_id;
    const user = relationOne(
      (row as { users: { full_name: string | null; email: string } | null }).users
    );
    if (!userId) {
      continue;
    }
    operators.set(userId, user?.full_name ?? user?.email ?? userId);
  }

  return {
    data: Array.from(operators.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "it")),
    error: null,
  };
}

export async function getContactHistoryDashboardMetrics(): Promise<{
  data: ContactHistoryDashboardMetrics | null;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();
  const weekStart = startOfWeekIso();
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);

  const [todayRes, weekRes, overdueRes] = await Promise.all([
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .in("type", [...CONTACT_HISTORY_TYPES])
      .eq("status", "done")
      .gte("occurred_at", todayStart),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .in("type", [...CONTACT_HISTORY_TYPES])
      .eq("status", "done")
      .gte("occurred_at", weekStart),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .in("type", [...CONTACT_HISTORY_TYPES])
      .eq("status", "done")
      .not("next_follow_up_at", "is", null)
      .lt("next_follow_up_at", todayStart),
  ]);

  const failed = todayRes.error ?? weekRes.error ?? overdueRes.error;
  if (failed) {
    return { data: null, error: describeDbError(failed) };
  }

  return {
    data: {
      activitiesToday: todayRes.count ?? 0,
      activitiesThisWeek: weekRes.count ?? 0,
      overdueActivities: overdueRes.count ?? 0,
    },
    error: null,
  };
}

export async function listRecentContactHistory(limit = 8): Promise<{
  data: ContactHistoryItem[];
  error: string | null;
}> {
  return listContactHistory({ limit });
}
