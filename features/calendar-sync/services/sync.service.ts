import "server-only";

import { getDefaultContactHistoryTitle, type ContactHistoryType } from "@/lib/constants/contact-history";
import { createServerClient } from "@/lib/supabase/server";
import {
  buildEntityRef,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "@/lib/google-calendar/api-client";
import {
  buildCalendarEventPayload,
  buildCancelledEventPayload,
  buildCompletedEventPayload,
  type EntityContext,
} from "@/lib/google-calendar/event-builder";
import type {
  CalendarEntityKind,
  CalendarSyncOperation,
} from "@/lib/google-calendar/types";
import {
  ensureGoogleAccessToken,
  getActiveGoogleCalendarConnection,
  recordConnectionSyncError,
  recordConnectionSyncSuccess,
} from "./connection.service";
import {
  getExternalEventMapping,
  markExternalEventDeleted,
  markExternalEventError,
  upsertExternalEventMapping,
} from "./external-events.service";

const VISIT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Pianificata",
  in_progress: "In corso",
  completed: "Completata",
  cancelled: "Annullata",
  no_show: "Assente",
};

const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  todo: "Da fare",
  completed: "Completato",
  postponed: "Rimandato",
  cancelled: "Annullato",
};

type CompanyRelation = { name: string } | { name: string }[] | null;

function relationCompanyName(value: CompanyRelation): string | null {
  if (!value) {
    return null;
  }
  const company = Array.isArray(value) ? value[0] : value;
  return company?.name ?? null;
}

async function loadEntityContext(
  kind: CalendarEntityKind,
  entityId: string
): Promise<EntityContext | null> {
  const supabase = await createServerClient();

  if (kind === "visit") {
    const { data, error } = await supabase
      .from("visits")
      .select("id,scheduled_at,notes,status,companies(name)")
      .eq("id", entityId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as {
      id: string;
      scheduled_at: string;
      notes: string | null;
      status: string;
      companies: CompanyRelation;
    };
    const companyName = relationCompanyName(row.companies);

    return {
      kind,
      entityId: row.id,
      title: companyName ? `Visita ${companyName}` : "Visita pianificata",
      notes: row.notes,
      scheduledAt: row.scheduled_at,
      companyName,
      statusLabel: VISIT_STATUS_LABELS[row.status] ?? row.status,
    };
  }

  if (kind === "follow_up") {
    const { data, error } = await supabase
      .from("follow_ups")
      .select(
        "id,scheduled_at,postponed_to,description,status,activity_type,companies(name)"
      )
      .eq("id", entityId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as {
      id: string;
      scheduled_at: string;
      postponed_to: string | null;
      description: string | null;
      status: string;
      activity_type: string;
      companies: CompanyRelation;
    };
    const companyName = relationCompanyName(row.companies);
    const scheduledAt =
      row.status === "postponed" && row.postponed_to ? row.postponed_to : row.scheduled_at;

    return {
      kind,
      entityId: row.id,
      title: getDefaultContactHistoryTitle(row.activity_type as ContactHistoryType),
      notes: row.description,
      scheduledAt,
      companyName,
      statusLabel: FOLLOW_UP_STATUS_LABELS[row.status] ?? row.status,
    };
  }

  const { data, error } = await supabase
    .from("agenda_reminders")
    .select("id,title,notes,scheduled_at,status,companies(name)")
    .eq("id", entityId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    id: string;
    title: string;
    notes: string | null;
    scheduled_at: string;
    status: string;
    companies: CompanyRelation;
  };
  const companyName = relationCompanyName(row.companies);

  return {
    kind,
    entityId: row.id,
    title: row.title,
    notes: row.notes,
    scheduledAt: row.scheduled_at,
    companyName,
    statusLabel: FOLLOW_UP_STATUS_LABELS[row.status] ?? row.status,
  };
}

function buildPayloadForOperation(
  context: EntityContext,
  operation: CalendarSyncOperation
) {
  if (operation === "complete") {
    return buildCompletedEventPayload(context);
  }
  if (operation === "cancel") {
    return buildCancelledEventPayload(context);
  }
  return buildCalendarEventPayload(context);
}

export async function syncCalendarEntity(
  kind: CalendarEntityKind,
  entityId: string,
  operation: CalendarSyncOperation
): Promise<void> {
  const connection = await getActiveGoogleCalendarConnection();
  if (!connection) {
    return;
  }

  const context = await loadEntityContext(kind, entityId);
  if (!context) {
    return;
  }

  const tokenResult = await ensureGoogleAccessToken(connection);
  if (tokenResult.error) {
    await recordConnectionSyncError(connection.user_id, tokenResult.error);
    await markExternalEventError(connection.user_id, kind, entityId, tokenResult.error);
    return;
  }

  const accessToken = tokenResult.accessToken;
  const activeConnection = tokenResult.connection;
  const entityRef = buildEntityRef(kind, entityId);
  const mapping = await getExternalEventMapping(activeConnection.user_id, kind, entityId);

  try {
    if (operation === "cancel") {
      if (mapping?.google_event_id) {
        await deleteGoogleCalendarEvent(
          accessToken,
          mapping.google_calendar_id,
          mapping.google_event_id
        );
      }
      await markExternalEventDeleted(activeConnection.user_id, kind, entityId);
      await recordConnectionSyncSuccess(activeConnection.user_id);
      return;
    }

    const payload = buildPayloadForOperation(context, operation);

    if (mapping?.google_event_id && mapping.sync_status !== "deleted") {
      await updateGoogleCalendarEvent(
        accessToken,
        mapping.google_calendar_id,
        mapping.google_event_id,
        payload,
        entityRef
      );

      await upsertExternalEventMapping({
        userId: activeConnection.user_id,
        kind,
        entityId,
        googleEventId: mapping.google_event_id,
        googleCalendarId: mapping.google_calendar_id,
        syncStatus: "synced",
      });
    } else if (operation === "upsert") {
      const created = await createGoogleCalendarEvent(
        accessToken,
        activeConnection.calendar_id,
        payload,
        entityRef
      );

      await upsertExternalEventMapping({
        userId: activeConnection.user_id,
        kind,
        entityId,
        googleEventId: created.id,
        googleCalendarId: activeConnection.calendar_id,
        syncStatus: "synced",
      });
    }

    await recordConnectionSyncSuccess(activeConnection.user_id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sincronizzazione Google Calendar non riuscita.";

    await recordConnectionSyncError(activeConnection.user_id, message);
    await markExternalEventError(activeConnection.user_id, kind, entityId, message);
  }
}

export async function triggerCalendarSync(
  kind: CalendarEntityKind,
  entityId: string,
  operation: CalendarSyncOperation
): Promise<void> {
  try {
    await syncCalendarEntity(kind, entityId, operation);
  } catch (error) {
    console.error("[calendar-sync]", kind, entityId, operation, error);
  }
}

export async function listAgendaCalendarSyncStatuses(
  userId: string,
  items: Array<{ kind: CalendarEntityKind; entityId: string; compositeId: string }>
): Promise<Record<string, string>> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("calendar_external_events")
    .select("entity_kind,entity_id,sync_status")
    .eq("user_id", userId);

  if (error || !data) {
    return {};
  }

  const byEntity = new Map<string, string>();
  for (const row of data as Array<{
    entity_kind: CalendarEntityKind;
    entity_id: string;
    sync_status: string;
  }>) {
    byEntity.set(`${row.entity_kind}:${row.entity_id}`, row.sync_status);
  }

  const result: Record<string, string> = {};
  for (const item of items) {
    const status = byEntity.get(`${item.kind}:${item.entityId}`);
    if (status) {
      result[item.compositeId] = status;
    }
  }

  return result;
}
