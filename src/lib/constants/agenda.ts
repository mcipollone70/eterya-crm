import type { ContactHistoryType } from "@/lib/constants/contact-history";
import type { FollowUpStatus } from "@/lib/constants/follow-up";
import type { VisitStatus } from "@/lib/supabase/types";

export const AGENDA_VIEW_OPTIONS = [
  { value: "day", label: "Giorno" },
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
] as const;

export type AgendaView = (typeof AGENDA_VIEW_OPTIONS)[number]["value"];

export const AGENDA_KIND_OPTIONS = [
  { value: "", label: "Tutte le tipologie" },
  { value: "visit", label: "Visite" },
  { value: "follow_up", label: "Follow-up" },
  { value: "reminder", label: "Promemoria" },
] as const;

export type AgendaKindFilter = (typeof AGENDA_KIND_OPTIONS)[number]["value"];

export const AGENDA_STATUS_OPTIONS = [
  { value: "", label: "Tutti gli stati" },
  { value: "open", label: "Aperti" },
  { value: "completed", label: "Completati" },
  { value: "cancelled", label: "Annullati" },
] as const;

export type AgendaStatusFilter = (typeof AGENDA_STATUS_OPTIONS)[number]["value"];

export type AgendaItemKind = "visit" | "follow_up" | "reminder";

const AGENDA_VIEW_SET = new Set<string>(AGENDA_VIEW_OPTIONS.map((option) => option.value));
const AGENDA_KIND_SET = new Set<string>(
  AGENDA_KIND_OPTIONS.map((option) => option.value).filter(Boolean)
);
const AGENDA_STATUS_SET = new Set<string>(
  AGENDA_STATUS_OPTIONS.map((option) => option.value).filter(Boolean)
);

export interface AgendaFilters {
  view: AgendaView;
  date: string;
  agentId: string | null;
  kind: AgendaKindFilter;
  status: AgendaStatusFilter;
}

export interface AgendaItem {
  id: string;
  kind: AgendaItemKind;
  title: string;
  scheduledAt: string;
  status: VisitStatus | FollowUpStatus | string;
  statusLabel: string;
  companyId: string | null;
  companyName: string | null;
  contactId: string | null;
  contactName: string | null;
  userId: string;
  operatorName: string | null;
  activityType: ContactHistoryType | null;
  priority: string | null;
  notes: string | null;
  opportunityId: string | null;
  opportunityTitle: string | null;
  canComplete: boolean;
  canEdit: boolean;
}

export const AGENDA_KIND_LABELS: Record<AgendaItemKind, string> = {
  visit: "Visita",
  follow_up: "Follow-up",
  reminder: "Promemoria",
};

export const AGENDA_KIND_COLORS: Record<AgendaItemKind, string> = {
  visit: "bg-violet-50 text-violet-800 border-violet-100",
  follow_up: "bg-indigo-50 text-indigo-800 border-indigo-100",
  reminder: "bg-amber-50 text-amber-800 border-amber-100",
};

export function isAgendaView(value: string | undefined): value is AgendaView {
  return value != null && AGENDA_VIEW_SET.has(value);
}

export function isAgendaKindFilter(value: string | undefined): value is AgendaKindFilter {
  if (!value) {
    return true;
  }
  return AGENDA_KIND_SET.has(value);
}

export function isAgendaStatusFilter(value: string | undefined): value is AgendaStatusFilter {
  if (!value) {
    return true;
  }
  return AGENDA_STATUS_SET.has(value);
}

export function parseAgendaDate(value: string | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return new Date().toISOString().slice(0, 10);
}

export function parseAgendaFilters(input: {
  view?: string;
  date?: string;
  agent?: string;
  kind?: string;
  status?: string;
}): AgendaFilters {
  return {
    view: isAgendaView(input.view) ? input.view : "day",
    date: parseAgendaDate(input.date),
    agentId: input.agent?.trim() || null,
    kind: isAgendaKindFilter(input.kind) ? (input.kind ?? "") : "",
    status: isAgendaStatusFilter(input.status) ? (input.status ?? "") : "",
  };
}

export function isVisitOpenStatus(status: VisitStatus): boolean {
  return status === "scheduled" || status === "in_progress";
}

export function isFollowUpOpenStatus(status: FollowUpStatus): boolean {
  return status === "todo" || status === "postponed";
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

export function matchesAgendaStatusFilter(
  kind: AgendaItemKind,
  status: string,
  filter: AgendaStatusFilter
): boolean {
  if (!filter) {
    return true;
  }

  if (filter === "open") {
    if (kind === "visit") {
      return isVisitOpenStatus(status as VisitStatus);
    }
    return isFollowUpOpenStatus(status as FollowUpStatus);
  }

  if (filter === "completed") {
    if (kind === "visit") {
      return status === "completed";
    }
    return status === "completed";
  }

  if (filter === "cancelled") {
    if (kind === "visit") {
      return status === "cancelled" || status === "no_show";
    }
    return status === "cancelled";
  }

  return true;
}
