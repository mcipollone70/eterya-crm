import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import {
  saveContactHistoryActivity,
  syncCompanyLastContact,
} from "@/features/activities/services/contact-history.service";
import {
  getDefaultContactHistoryTitle,
  isContactHistoryType,
  type ContactHistoryType,
} from "@/lib/constants/contact-history";
import {
  getFollowUpEffectiveDate,
  type FollowUpPeriod,
  type FollowUpPriority,
  type FollowUpStatus,
} from "@/lib/constants/follow-up";
import { groupFollowUpsByDay as groupFollowUpItemsByDay } from "@/lib/follow-up/calendar";
import { startOfTodayIso, startOfWeekIso } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { ActivityPriority, Tables } from "@/lib/supabase/types";

export type FollowUp = Tables<"follow_ups">;

export interface FollowUpListItem {
  id: string;
  company_id: string;
  company_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  user_id: string;
  operator_name: string | null;
  activity_type: ContactHistoryType;
  description: string | null;
  priority: ActivityPriority;
  status: FollowUpStatus;
  scheduled_at: string;
  postponed_to: string | null;
  completed_at: string | null;
  effective_at: string;
  created_at: string;
}

export interface SaveFollowUpInput {
  companyId: string;
  contactId?: string | null;
  activityType: ContactHistoryType;
  description?: string | null;
  priority?: ActivityPriority;
  scheduledAt: string;
}

export interface ListFollowUpsFilters {
  companyId?: string;
  status?: FollowUpStatus | null;
  priority?: FollowUpPriority | null;
  period?: FollowUpPeriod | null;
  limit?: number;
}

export interface FollowUpDashboardMetrics {
  today: number;
  overdue: number;
  next7Days: number;
  highPriority: number;
}

export interface CompanyOption {
  id: string;
  name: string;
}

const FOLLOW_UP_SELECT =
  "id,company_id,contact_id,user_id,activity_type,description,priority,status,scheduled_at,postponed_to,completed_at,created_at,companies(name),contacts(full_name),users(full_name,email)";

type FollowUpRow = {
  id: string;
  company_id: string;
  contact_id: string | null;
  user_id: string;
  activity_type: string;
  description: string | null;
  priority: ActivityPriority;
  status: FollowUpStatus;
  scheduled_at: string;
  postponed_to: string | null;
  completed_at: string | null;
  created_at: string;
  companies: { name: string } | { name: string }[] | null;
  contacts: { full_name: string } | { full_name: string }[] | null;
  users: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapFollowUpRow(row: FollowUpRow): FollowUpListItem | null {
  if (!isContactHistoryType(row.activity_type)) {
    return null;
  }

  const company = relationOne(row.companies);
  const contact = relationOne(row.contacts);
  const operator = relationOne(row.users);

  return {
    id: row.id,
    company_id: row.company_id,
    company_name: company?.name ?? null,
    contact_id: row.contact_id,
    contact_name: contact?.full_name ?? null,
    user_id: row.user_id,
    operator_name: operator?.full_name ?? operator?.email ?? null,
    activity_type: row.activity_type,
    description: row.description,
    priority: row.priority,
    status: row.status,
    scheduled_at: row.scheduled_at,
    postponed_to: row.postponed_to,
    completed_at: row.completed_at,
    effective_at: getFollowUpEffectiveDate(row),
    created_at: row.created_at,
  };
}

function isOpenFollowUp(item: FollowUpListItem): boolean {
  return item.status === "todo" || item.status === "postponed";
}

async function resolveFollowUpUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

function endOfTodayIso(): string {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function endOfNext7DaysIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function applyFollowUpPeriod(
  items: FollowUpListItem[],
  period: FollowUpPeriod | null | undefined
): FollowUpListItem[] {
  if (!period) {
    return items;
  }

  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();
  const next7End = endOfNext7DaysIso();
  const weekStart = startOfWeekIso();

  return items.filter((item) => {
    const effective = item.effective_at;

    switch (period) {
      case "today":
        return effective >= todayStart && effective <= todayEnd;
      case "next7":
        return effective >= todayStart && effective <= next7End;
      case "week":
        return effective >= weekStart && effective <= todayEnd;
      case "overdue":
        return isOpenFollowUp(item) && effective < todayStart;
      default:
        return true;
    }
  });
}

export async function listFollowUps(
  filters: ListFollowUpsFilters = {}
): Promise<{ data: FollowUpListItem[]; error: string | null }> {
  const supabase = await createServerClient();
  const limit = filters.limit ?? 300;

  let query = supabase
    .from("follow_ups")
    .select(FOLLOW_UP_SELECT)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (filters.companyId) {
    query = query.eq("company_id", filters.companyId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }

  const { data, error } = await query;
  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  let items = (data ?? [])
    .map((row) => mapFollowUpRow(row as FollowUpRow))
    .filter((item): item is FollowUpListItem => item !== null);

  items = applyFollowUpPeriod(items, filters.period);

  return { data: items, error: null };
}

export async function listFollowUpCompanyOptions(): Promise<{
  data: CompanyOption[];
  error: string | null;
}> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id,name")
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return {
    data: (data ?? []).map((row) => ({ id: row.id, name: row.name })),
    error: null,
  };
}

export async function saveFollowUp(
  input: SaveFollowUpInput
): Promise<{ followUpId: string | null; error: string | null }> {
  const userId = await resolveFollowUpUserId();
  if (!userId) {
    return { followUpId: null, error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .insert({
      company_id: input.companyId,
      contact_id: input.contactId ?? null,
      user_id: userId,
      activity_type: input.activityType,
      description: input.description?.trim() || null,
      priority: input.priority ?? "medium",
      status: "todo",
      scheduled_at: input.scheduledAt,
    })
    .select("id")
    .single();

  if (error) {
    return { followUpId: null, error: describeDbError(error) };
  }

  return { followUpId: data.id, error: null };
}

async function getFollowUpById(id: string): Promise<FollowUpListItem | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select(FOLLOW_UP_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapFollowUpRow(data as FollowUpRow);
}

export async function completeFollowUp(
  id: string
): Promise<{ success: boolean; message: string }> {
  const followUp = await getFollowUpById(id);
  if (!followUp) {
    return { success: false, message: "Follow-up non trovato." };
  }

  if (followUp.status === "completed") {
    return { success: false, message: "Follow-up già completato." };
  }

  const completedAt = new Date().toISOString();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({
      status: "completed",
      completed_at: completedAt,
    })
    .eq("id", id);

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Errore database." };
  }

  const historyResult = await saveContactHistoryActivity({
    companyId: followUp.company_id,
    type: followUp.activity_type,
    title: `Follow-up: ${getDefaultContactHistoryTitle(followUp.activity_type)}`,
    description: followUp.description,
    occurredAt: completedAt,
    source: "manual",
  });

  if (historyResult.error) {
    return { success: false, message: historyResult.error };
  }

  await syncCompanyLastContact(followUp.company_id);

  return { success: true, message: "Follow-up completato e registrato nello storico." };
}

export async function postponeFollowUp(
  id: string,
  postponedTo?: string
): Promise<{ success: boolean; message: string }> {
  const followUp = await getFollowUpById(id);
  if (!followUp) {
    return { success: false, message: "Follow-up non trovato." };
  }

  if (followUp.status === "completed" || followUp.status === "cancelled") {
    return { success: false, message: "Il follow-up non può essere rimandato." };
  }

  const baseDate = new Date(getFollowUpEffectiveDate(followUp));
  if (!postponedTo) {
    baseDate.setDate(baseDate.getDate() + 1);
  }

  const nextDate = postponedTo ? new Date(postponedTo) : baseDate;
  if (Number.isNaN(nextDate.getTime())) {
    return { success: false, message: "Data di rimando non valida." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({
      status: "postponed",
      postponed_to: nextDate.toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Errore database." };
  }

  return { success: true, message: "Follow-up rimandato." };
}

export async function cancelFollowUp(
  id: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Errore database." };
  }

  return { success: true, message: "Follow-up annullato." };
}

export async function getFollowUpDashboardMetrics(): Promise<{
  data: FollowUpDashboardMetrics | null;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();
  const next7End = endOfNext7DaysIso();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_follow_up_dashboard_metrics" as never,
    {
      p_today_start: todayStart,
      p_today_end: todayEnd,
      p_next7_end: next7End,
    } as never
  );

  if (!rpcError && rpcData && typeof rpcData === "object") {
    const row = rpcData as Record<string, unknown>;
    return {
      data: {
        today: Number(row.today ?? 0),
        overdue: Number(row.overdue ?? 0),
        next7Days: Number(row.next7Days ?? 0),
        highPriority: Number(row.highPriority ?? 0),
      },
      error: null,
    };
  }

  const { data, error } = await listFollowUps({ limit: 1000 });
  if (error) {
    return { data: null, error };
  }

  let today = 0;
  let overdue = 0;
  let next7Days = 0;
  let highPriority = 0;

  for (const item of data) {
    if (!isOpenFollowUp(item)) {
      continue;
    }

    const effective = item.effective_at;

    if (effective >= todayStart && effective <= todayEnd) {
      today += 1;
    }

    if (effective < todayStart) {
      overdue += 1;
    }

    if (effective >= todayStart && effective <= next7End) {
      next7Days += 1;
    }

    if (item.priority === "high") {
      highPriority += 1;
    }
  }

  return {
    data: { today, overdue, next7Days, highPriority },
    error: null,
  };
}

export { groupFollowUpItemsByDay as groupFollowUpsByDay };
