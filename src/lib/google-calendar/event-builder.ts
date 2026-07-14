import "server-only";

import { getAppBaseUrl } from "./env";
import type { CalendarEntityKind, CalendarEventPayload } from "./types";
import { defaultEventEnd } from "./api-client";

interface EntityContext {
  kind: CalendarEntityKind;
  entityId: string;
  title: string;
  notes: string | null;
  scheduledAt: string;
  companyName: string | null;
  statusLabel: string;
}

function crmLink(kind: CalendarEntityKind, entityId: string, companyId: string | null): string {
  const base = getAppBaseUrl();
  if (companyId) {
    return `${base}/companies/${companyId}`;
  }
  if (kind === "visit") {
    return `${base}/visits`;
  }
  return `${base}/agenda`;
}

export function buildCalendarEventPayload(context: EntityContext): CalendarEventPayload {
  const companySuffix = context.companyName ? ` · ${context.companyName}` : "";
  const prefix =
    context.kind === "visit"
      ? "Visita"
      : context.kind === "follow_up"
        ? "Follow-up"
        : "Promemoria";

  const summary = `${prefix}${companySuffix}: ${context.title}`.slice(0, 250);
  const descriptionParts = [
    `Stato CRM: ${context.statusLabel}`,
    context.notes?.trim() || null,
    `Apri in Eterya CRM: ${crmLink(context.kind, context.entityId, null)}`,
  ].filter(Boolean);

  return {
    summary,
    description: descriptionParts.join("\n\n"),
    startAt: context.scheduledAt,
    endAt: defaultEventEnd(context.scheduledAt),
    status: context.statusLabel === "Annullato" ? "cancelled" : "confirmed",
  };
}

export function buildCompletedEventPayload(context: EntityContext): CalendarEventPayload {
  const payload = buildCalendarEventPayload({
    ...context,
    title: `[Completato] ${context.title}`,
    statusLabel: "Completato",
  });
  return payload;
}

export function buildCancelledEventPayload(context: EntityContext): CalendarEventPayload {
  return buildCalendarEventPayload({
    ...context,
    title: `[Annullato] ${context.title}`,
    statusLabel: "Annullato",
  });
}

export type { EntityContext };
