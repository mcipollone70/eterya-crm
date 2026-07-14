import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type {
  CalendarEntityKind,
  CalendarExternalEventRow,
  CalendarSyncStatus,
} from "@/lib/google-calendar/types";

export interface AgendaSyncStatusMap {
  [compositeId: string]: CalendarSyncStatus;
}

export function toCompositeEntityId(kind: CalendarEntityKind, entityId: string): string {
  return `${kind}:${entityId}`;
}

export async function getExternalEventMapping(
  userId: string,
  kind: CalendarEntityKind,
  entityId: string
): Promise<CalendarExternalEventRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("calendar_external_events")
    .select("*")
    .eq("user_id", userId)
    .eq("entity_kind", kind)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CalendarExternalEventRow;
}

export async function upsertExternalEventMapping(input: {
  userId: string;
  kind: CalendarEntityKind;
  entityId: string;
  googleEventId: string;
  googleCalendarId: string;
  syncStatus: CalendarSyncStatus;
  lastError?: string | null;
}): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("calendar_external_events").upsert(
    {
      user_id: input.userId,
      entity_kind: input.kind,
      entity_id: input.entityId,
      google_event_id: input.googleEventId,
      google_calendar_id: input.googleCalendarId,
      sync_status: input.syncStatus,
      last_synced_at: new Date().toISOString(),
      last_error: input.lastError ?? null,
    },
    { onConflict: "user_id,entity_kind,entity_id" }
  );

  return { error: describeDbError(error) };
}

export async function markExternalEventDeleted(
  userId: string,
  kind: CalendarEntityKind,
  entityId: string
): Promise<void> {
  const supabase = await createServerClient();
  await supabase
    .from("calendar_external_events")
    .update({
      sync_status: "deleted",
      last_synced_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("user_id", userId)
    .eq("entity_kind", kind)
    .eq("entity_id", entityId);
}

export async function markExternalEventError(
  userId: string,
  kind: CalendarEntityKind,
  entityId: string,
  message: string
): Promise<void> {
  const supabase = await createServerClient();
  await supabase
    .from("calendar_external_events")
    .update({
      sync_status: "error",
      last_error: message,
    })
    .eq("user_id", userId)
    .eq("entity_kind", kind)
    .eq("entity_id", entityId);
}

export async function listSyncStatusesForEntities(
  userId: string,
  items: Array<{ kind: CalendarEntityKind; entityId: string }>
): Promise<AgendaSyncStatusMap> {
  if (items.length === 0) {
    return {};
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("calendar_external_events")
    .select("entity_kind,entity_id,sync_status")
    .eq("user_id", userId);

  if (error || !data) {
    return {};
  }

  const map: AgendaSyncStatusMap = {};
  for (const row of data as Array<{
    entity_kind: CalendarEntityKind;
    entity_id: string;
    sync_status: CalendarSyncStatus;
  }>) {
    map[toCompositeEntityId(row.entity_kind, row.entity_id)] = row.sync_status;
  }

  return map;
}
