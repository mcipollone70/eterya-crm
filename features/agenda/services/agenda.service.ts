import "server-only";

import { cache } from "react";
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
  type AgendaFilters,
  type AgendaItem,
  type AgendaItemKind,
  type AgendaKindFilter,
  type AgendaStatusFilter,
  type AgendaView,
  matchesAgendaStatusFilter,
} from "@/lib/constants/agenda";
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

function mapGoogleEventToAgendaItem(row: {
  id: string;
  user_id: string;
  summary: string;
  description: string | null;
  start_at: string;
  status: string | null;
  html_link: string | null;
}): AgendaItem {
  const cancelled = row.status === "cancelled";
  const notesParts = [
    row.description?.trim() || null,
    row.html_link ? `Apri in Google Calendar: ${row.html_link}` : null,
    "Evento importato da Google — non convertito automaticamente in appuntamento CRM.",
  ].filter(Boolean);

  return {
    id: `google_event:${row.id}`,
    kind: "google_event",
    title: row.summary || "Evento Google",
    scheduledAt: row.start_at,
    status: cancelled ? "cancelled" : "todo",
    statusLabel: cancelled ? "Annullato" : "Evento Google",
    companyId: null,
    companyName: null,
    contactId: null,
    contactName: null,
    userId: row.user_id,
    operatorName: null,
    activityType: null,
    priority: null,
    notes: notesParts.join("\n\n"),
    opportunityId: null,
    opportunityTitle: null,
    canComplete: false,
    canEdit: false,
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
    return true;
  });
}

function applyVisitStatusToQuery<T extends { in: (col: string, vals: string[]) => T; eq: (col: string, val: string) => T; or: (filters: string) => T; gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  status: AgendaStatusFilter,
  range: { startIso: string; endIso: string }
): T {
  if (status === "open") {
    return query
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_at", range.startIso)
      .lte("scheduled_at", range.endIso);
  }
  if (status === "completed") {
    return query
      .eq("status", "completed")
      .gte("completed_at", range.startIso)
      .lte("completed_at", range.endIso);
  }
  if (status === "cancelled") {
    return query
      .in("status", ["cancelled", "no_show"])
      .gte("scheduled_at", range.startIso)
      .lte("scheduled_at", range.endIso);
  }

  return query.or(
    `and(status.in.(scheduled,in_progress),scheduled_at.gte.${range.startIso},scheduled_at.lte.${range.endIso}),and(status.eq.completed,completed_at.gte.${range.startIso},completed_at.lte.${range.endIso})`
  );
}

function applyFollowUpStatusToQuery<T extends { in: (col: string, vals: string[]) => T; eq: (col: string, val: string) => T; or: (filters: string) => T; gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  status: AgendaStatusFilter,
  range: { startIso: string; endIso: string }
): T {
  if (status === "open") {
    return query
      .in("status", ["todo", "postponed"])
      .or(
        `and(scheduled_at.gte.${range.startIso},scheduled_at.lte.${range.endIso}),and(postponed_to.gte.${range.startIso},postponed_to.lte.${range.endIso})`
      );
  }
  if (status === "completed") {
    return query
      .eq("status", "completed")
      .gte("completed_at", range.startIso)
      .lte("completed_at", range.endIso);
  }
  if (status === "cancelled") {
    return query
      .eq("status", "cancelled")
      .gte("scheduled_at", range.startIso)
      .lte("scheduled_at", range.endIso);
  }

  return query.or(
    `and(scheduled_at.gte.${range.startIso},scheduled_at.lte.${range.endIso}),and(postponed_to.gte.${range.startIso},postponed_to.lte.${range.endIso})`
  );
}

function applyReminderStatusToQuery<T extends { in: (col: string, vals: string[]) => T; eq: (col: string, val: string) => T; gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  status: AgendaStatusFilter,
  range: { startIso: string; endIso: string }
): T {
  query = query.gte("scheduled_at", range.startIso).lte("scheduled_at", range.endIso);

  if (status === "open") {
    return query.in("status", ["todo", "postponed"]);
  }
  if (status === "completed") {
    return query.eq("status", "completed");
  }
  if (status === "cancelled") {
    return query.eq("status", "cancelled");
  }

  return query;
}

async function listAgendaItemsUncached(
  filters: AgendaFilters
): Promise<{ data: AgendaItem[]; rangeLabel: string; error: string | null }> {
  const supabase = await createServerClient();
  const range = resolveAgendaRange(filters.view, filters.date);

  const kinds: AgendaItemKind[] = filters.kind
    ? [filters.kind as AgendaItemKind]
    : ["visit", "follow_up", "reminder", "google_event"];

  const queries: Promise<{ data: AgendaItem[]; error: string | null }>[] = [];

  if (kinds.includes("visit")) {
    queries.push(
      (async () => {
        let query = supabase
          .from("visits")
          .select(
            "id,company_id,user_id,scheduled_at,completed_at,status,notes,companies(name),users(full_name,email)"
          )
          .order("scheduled_at", { ascending: true })
          .limit(500);

        query = applyVisitStatusToQuery(query, filters.status, range);

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
          .order("scheduled_at", { ascending: true })
          .limit(500);

        query = applyFollowUpStatusToQuery(query, filters.status, range);

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
          .order("scheduled_at", { ascending: true })
          .limit(500);

        query = applyReminderStatusToQuery(query, filters.status, range);

        if (filters.agentId) {
          query = query.eq("user_id", filters.agentId);
        }

        const { data, error } = await query;
        if (error) {
          return { data: [], error: describeDbError(error) };
        }

        return {
          data: (data ?? []).map((row) =>
            mapReminderToAgendaItem(
              row as unknown as Parameters<typeof mapReminderToAgendaItem>[0]
            )
          ),
          error: null,
        };
      })()
    );
  }

  if (kinds.includes("google_event")) {
    queries.push(
      (async () => {
        const { listGoogleAgendaEvents } = await import(
          "@/features/calendar-sync/services/inbound-sync.service"
        );
        const { data, error } = await listGoogleAgendaEvents({
          userId: filters.agentId,
          startIso: range.startIso,
          endIso: range.endIso,
        });
        if (error) {
          return { data: [], error };
        }

        const items = data
          .map((row) =>
            mapGoogleEventToAgendaItem({
              id: row.id,
              user_id: row.user_id,
              summary: row.summary,
              description: row.description,
              start_at: row.start_at,
              status: row.status,
              html_link: row.html_link,
            })
          )
          .filter((item) =>
            matchesAgendaStatusFilter(item.kind, item.status, filters.status)
          );

        return { data: items, error: null };
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
  items.sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

  return { data: items, rangeLabel: range.label, error: null };
}

const cachedListAgendaItems = cache(
  async (
    view: AgendaView,
    date: string,
    agentId: string | null,
    kind: AgendaKindFilter,
    status: AgendaStatusFilter
  ): Promise<{ data: AgendaItem[]; rangeLabel: string; error: string | null }> =>
    listAgendaItemsUncached({ view, date, agentId, kind, status })
);

export async function listAgendaItems(
  filters: AgendaFilters
): Promise<{ data: AgendaItem[]; rangeLabel: string; error: string | null }> {
  return cachedListAgendaItems(
    filters.view,
    filters.date,
    filters.agentId,
    filters.kind,
    filters.status
  );
}

export const listAgendaAgents = cache(async (): Promise<{
  data: Array<{ id: string; label: string }>;
  error: string | null;
}> => {
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
});

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
    (kind === "visit" ||
      kind === "follow_up" ||
      kind === "reminder" ||
      kind === "google_event") &&
    sourceId
  ) {
    return { kind, sourceId };
  }
  return null;
}

export type { ContactHistoryType };
