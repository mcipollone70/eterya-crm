import "server-only";

import {
  CONTACT_HISTORY_TYPE_LABELS,
  isContactHistoryType,
  type ContactHistoryType,
} from "@/lib/constants/contact-history";
import {
  FOLLOW_UP_PRIORITY_LABELS,
  FOLLOW_UP_STATUS_LABELS,
  getFollowUpEffectiveDate,
  type FollowUpStatus,
} from "@/lib/constants/follow-up";
import {
  matchesAgendaStatusFilter,
  type AgendaFilters,
  type AgendaItem,
  type AgendaItemKind,
} from "@/lib/constants/agenda";
import { OPEN_OPPORTUNITY_STAGES } from "@/lib/constants/opportunity-pipeline";
import { resolveAgendaRange } from "@/lib/agenda/calendar";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { ActivityPriority, VisitStatus } from "@/lib/supabase/types";

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: "Pianificata",
  in_progress: "In corso",
  completed: "Completata",
  cancelled: "Annullata",
  no_show: "Assente",
};

const FOLLOW_UP_SELECT =
  "id,company_id,contact_id,user_id,activity_type,description,priority,status,scheduled_at,postponed_to,completed_at,companies(name),contacts(full_name),users(full_name,email)";

const REMINDER_SELECT =
  "id,user_id,company_id,contact_id,opportunity_id,title,notes,scheduled_at,status,completed_at,companies(name),contacts(full_name),opportunities(title),users(full_name,email)";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function visitEffectiveAt(status: VisitStatus, scheduledAt: string, completedAt: string | null): string {
  if (status === "completed" && completedAt) {
    return completedAt;
  }
  return scheduledAt;
}

function mapVisitToAgendaItem(row: {
  id: string;
  company_id: string;
  user_id: string;
  scheduled_at: string;
  completed_at: string | null;
  status: VisitStatus;
  notes: string | null;
  companies: { name: string } | { name: string }[] | null;
  users: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
}): AgendaItem {
  const company = relationOne(row.companies);
  const operator = relationOne(row.users);
  const effectiveAt = visitEffectiveAt(row.status, row.scheduled_at, row.completed_at);
  const canComplete = row.status === "scheduled" || row.status === "in_progress";
  const canEdit = canComplete;

  return {
    id: `visit:${row.id}`,
    kind: "visit",
    title: "Visita",
    scheduledAt: effectiveAt,
    status: row.status,
    statusLabel: VISIT_STATUS_LABELS[row.status],
    companyId: row.company_id,
    companyName: company?.name ?? null,
    contactId: null,
    contactName: null,
    userId: row.user_id,
    operatorName: operator?.full_name ?? operator?.email ?? null,
    activityType: "visit",
    priority: null,
    notes: row.notes,
    opportunityId: null,
    opportunityTitle: null,
    canComplete,
    canEdit,
  };
}

function mapFollowUpToAgendaItem(row: {
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
  companies: { name: string } | { name: string }[] | null;
  contacts: { full_name: string } | { full_name: string }[] | null;
  users: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
}): AgendaItem | null {
  if (!isContactHistoryType(row.activity_type)) {
    return null;
  }

  const company = relationOne(row.companies);
  const contact = relationOne(row.contacts);
  const operator = relationOne(row.users);
  const effectiveAt = getFollowUpEffectiveDate(row);
  const canAct = row.status === "todo" || row.status === "postponed";

  return {
    id: `follow_up:${row.id}`,
    kind: "follow_up",
    title: CONTACT_HISTORY_TYPE_LABELS[row.activity_type],
    scheduledAt: effectiveAt,
    status: row.status,
    statusLabel: FOLLOW_UP_STATUS_LABELS[row.status],
    companyId: row.company_id,
    companyName: company?.name ?? null,
    contactId: row.contact_id,
    contactName: contact?.full_name ?? null,
    userId: row.user_id,
    operatorName: operator?.full_name ?? operator?.email ?? null,
    activityType: row.activity_type,
    priority: FOLLOW_UP_PRIORITY_LABELS[row.priority],
    notes: row.description,
    opportunityId: null,
    opportunityTitle: null,
    canComplete: canAct,
    canEdit: canAct,
  };
}

function mapReminderToAgendaItem(row: {
  id: string;
  user_id: string;
  company_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  title: string;
  notes: string | null;
  scheduled_at: string;
  status: FollowUpStatus;
  companies: { name: string } | { name: string }[] | null;
  contacts: { full_name: string } | { full_name: string }[] | null;
  opportunities: { title: string } | { title: string }[] | null;
  users: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
}): AgendaItem {
  const company = relationOne(row.companies);
  const contact = relationOne(row.contacts);
  const opportunity = relationOne(row.opportunities);
  const operator = relationOne(row.users);
  const canAct = row.status === "todo" || row.status === "postponed";

  return {
    id: `reminder:${row.id}`,
    kind: "reminder",
    title: row.title,
    scheduledAt: row.scheduled_at,
    status: row.status,
    statusLabel: FOLLOW_UP_STATUS_LABELS[row.status],
    companyId: row.company_id,
    companyName: company?.name ?? null,
    contactId: row.contact_id,
    contactName: contact?.full_name ?? null,
    userId: row.user_id,
    operatorName: operator?.full_name ?? operator?.email ?? null,
    activityType: null,
    priority: null,
    notes: row.notes,
    opportunityId: row.opportunity_id,
    opportunityTitle: opportunity?.title ?? null,
    canComplete: canAct,
    canEdit: canAct,
  };
}

function applyAgendaFilters(items: AgendaItem[], filters: AgendaFilters): AgendaItem[] {
  return items.filter((item) => {
    if (filters.agentId && item.userId !== filters.agentId) {
      return false;
    }
    if (filters.kind && item.kind !== filters.kind) {
      return false;
    }
    if (!matchesAgendaStatusFilter(item.kind, String(item.status), filters.status)) {
      return false;
    }
    return true;
  });
}

async function enrichOpportunityLinks(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  items: AgendaItem[]
): Promise<AgendaItem[]> {
  const companyIds = [
    ...new Set(
      items
        .filter((item) => item.companyId && !item.opportunityId)
        .map((item) => item.companyId as string)
    ),
  ];

  if (companyIds.length === 0) {
    return items;
  }

  const { data } = await supabase
    .from("opportunities")
    .select("id,company_id,title")
    .in("company_id", companyIds)
    .in("stage", [...OPEN_OPPORTUNITY_STAGES])
    .order("total_amount", { ascending: false });

  const byCompany = new Map<string, { id: string; title: string }>();
  for (const row of data ?? []) {
    if (!byCompany.has(row.company_id)) {
      byCompany.set(row.company_id, { id: row.id, title: row.title });
    }
  }

  return items.map((item) => {
    if (!item.companyId || item.opportunityId) {
      return item;
    }
    const opportunity = byCompany.get(item.companyId);
    if (!opportunity) {
      return item;
    }
    return {
      ...item,
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
    };
  });
}

export async function listAgendaItems(
  filters: AgendaFilters
): Promise<{ data: AgendaItem[]; rangeLabel: string; error: string | null }> {
  const supabase = await createServerClient();
  const range = resolveAgendaRange(filters.view, filters.date);

  const kinds: AgendaItemKind[] = filters.kind
    ? [filters.kind as AgendaItemKind]
    : ["visit", "follow_up", "reminder"];

  const queries: Promise<{ data: AgendaItem[]; error: string | null }>[] = [];

  if (kinds.includes("visit")) {
    queries.push(
      (async () => {
        let query = supabase
          .from("visits")
          .select(
            "id,company_id,user_id,scheduled_at,completed_at,status,notes,companies(name),users(full_name,email)"
          )
          .or(
            `and(status.in.(scheduled,in_progress),scheduled_at.gte.${range.startIso},scheduled_at.lte.${range.endIso}),and(status.eq.completed,completed_at.gte.${range.startIso},completed_at.lte.${range.endIso})`
          )
          .order("scheduled_at", { ascending: true })
          .limit(500);

        if (filters.agentId) {
          query = query.eq("user_id", filters.agentId);
        }

        const { data, error } = await query;
        if (error) {
          return { data: [], error: describeDbError(error) };
        }

        return {
          data: (data ?? []).map((row) =>
            mapVisitToAgendaItem(
              row as {
                id: string;
                company_id: string;
                user_id: string;
                scheduled_at: string;
                completed_at: string | null;
                status: VisitStatus;
                notes: string | null;
                companies: { name: string } | { name: string }[] | null;
                users:
                  | { full_name: string | null; email: string }
                  | { full_name: string | null; email: string }[]
                  | null;
              }
            )
          ),
          error: null,
        };
      })()
    );
  }

  if (kinds.includes("follow_up")) {
    queries.push(
      (async () => {
        let query = supabase
          .from("follow_ups")
          .select(FOLLOW_UP_SELECT)
          .or(
            `and(scheduled_at.gte.${range.startIso},scheduled_at.lte.${range.endIso}),and(postponed_to.gte.${range.startIso},postponed_to.lte.${range.endIso})`
          )
          .order("scheduled_at", { ascending: true })
          .limit(500);

        if (filters.agentId) {
          query = query.eq("user_id", filters.agentId);
        }

        const { data, error } = await query;
        if (error) {
          return { data: [], error: describeDbError(error) };
        }

        const items = (data ?? [])
          .map((row) => mapFollowUpToAgendaItem(row as Parameters<typeof mapFollowUpToAgendaItem>[0]))
          .filter((item): item is AgendaItem => item !== null)
          .filter(
            (item) =>
              item.scheduledAt >= range.startIso && item.scheduledAt <= range.endIso
          );

        return { data: items, error: null };
      })()
    );
  }

  if (kinds.includes("reminder")) {
    queries.push(
      (async () => {
        let query = supabase
          .from("agenda_reminders")
          .select(REMINDER_SELECT)
          .gte("scheduled_at", range.startIso)
          .lte("scheduled_at", range.endIso)
          .order("scheduled_at", { ascending: true })
          .limit(500);

        if (filters.agentId) {
          query = query.eq("user_id", filters.agentId);
        }

        const { data, error } = await query;
        if (error) {
          return { data: [], error: describeDbError(error) };
        }

        return {
          data: (data ?? []).map((row) =>
            mapReminderToAgendaItem(row as Parameters<typeof mapReminderToAgendaItem>[0])
          ),
          error: null,
        };
      })()
    );
  }

  const results = await Promise.all(queries);
  const firstError = results.find((result) => result.error)?.error ?? null;
  if (firstError) {
    return { data: [], rangeLabel: range.label, error: firstError };
  }

  let items = results.flatMap((result) => result.data);
  items = applyAgendaFilters(items, filters);
  items = await enrichOpportunityLinks(supabase, items);
  items.sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

  return { data: items, rangeLabel: range.label, error: null };
}

export async function listAgendaAgents(): Promise<{
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

export async function listAgendaCompanyOptions(): Promise<{
  data: Array<{ id: string; name: string }>;
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

  return { data: data ?? [], error: null };
}


export function parseAgendaItemId(
  compositeId: string
): { kind: AgendaItemKind; sourceId: string } | null {
  const [kind, sourceId] = compositeId.split(":");
  if (
    (kind === "visit" || kind === "follow_up" || kind === "reminder") &&
    sourceId
  ) {
    return { kind, sourceId };
  }
  return null;
}

export type { ContactHistoryType };
