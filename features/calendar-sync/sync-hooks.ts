import "server-only";

import { triggerCalendarSync } from "@/features/calendar-sync/services/sync.service";
import type { CalendarEntityKind } from "@/lib/google-calendar/types";

export async function syncVisitCalendar(
  visitId: string,
  operation: "upsert" | "complete" | "cancel"
): Promise<void> {
  await triggerCalendarSync("visit", visitId, operation);
}

export async function syncFollowUpCalendar(
  followUpId: string,
  operation: "upsert" | "complete" | "cancel"
): Promise<void> {
  await triggerCalendarSync("follow_up", followUpId, operation);
}

export async function syncReminderCalendar(
  reminderId: string,
  operation: "upsert" | "complete" | "cancel"
): Promise<void> {
  await triggerCalendarSync("reminder", reminderId, operation);
}

export async function syncAgendaCompositeCalendar(
  compositeId: string,
  operation: "upsert" | "complete" | "cancel"
): Promise<void> {
  const [kind, entityId] = compositeId.split(":");
  if (!kind || !entityId) {
    return;
  }

  if (kind === "visit" || kind === "follow_up" || kind === "reminder") {
    await triggerCalendarSync(kind as CalendarEntityKind, entityId, operation);
  }
}
