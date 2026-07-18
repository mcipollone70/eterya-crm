import "server-only";

import { listAgendaItems } from "@/features/agenda/services/agenda.service";
import { AGENDA_KIND_LABELS, parseAgendaFilters } from "@/lib/constants/agenda";
import type { AgendaItem } from "@/lib/constants/agenda";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyAgendaItem {
  id: string;
  title: string;
  scheduledAt: string;
  kind: string;
  kindLabel: string;
}

function mapAgendaItem(item: AgendaItem): JoyAgendaItem {
  return {
    id: item.id,
    title: item.title,
    scheduledAt: item.scheduledAt,
    kind: item.kind,
    kindLabel: AGENDA_KIND_LABELS[item.kind],
  };
}

async function fetchAgendaForDate(
  dateIso: string,
  userId: string | null,
  onlyUpcoming = false
): Promise<JoyToolResult<JoyAgendaItem[]>> {
  const { data, error } = await listAgendaItems(
    parseAgendaFilters({
      view: "day",
      date: dateIso,
      agent: userId ?? undefined,
      status: "open",
    })
  );

  if (error) {
    return emptyToolResult([], error);
  }

  let items = (data ?? []).map(mapAgendaItem);
  if (onlyUpcoming) {
    const now = Date.now();
    items = items.filter((item) => new Date(item.scheduledAt).getTime() >= now);
  }

  return successToolResult(items);
}

export async function getAgendaToday(
  userId: string | null
): Promise<JoyToolResult<JoyAgendaItem[]>> {
  const today = new Date().toISOString().slice(0, 10);
  return fetchAgendaForDate(today, userId, true);
}

export async function getAgendaTomorrow(
  userId: string | null
): Promise<JoyToolResult<JoyAgendaItem[]>> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return fetchAgendaForDate(tomorrow.toISOString().slice(0, 10), userId, false);
}
