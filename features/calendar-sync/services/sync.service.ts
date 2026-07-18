import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { getDefaultContactHistoryTitle, type ContactHistoryType } from "@/lib/constants/contact-history";
import { createServerClient } from "@/lib/supabase/server";
import {
  buildEntityRef,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  isGoogleCalendarEventMissingError,
  isGoogleCalendarUnauthorizedError,
  updateGoogleCalendarEvent,
} from "@/lib/google-calendar/api-client";
import {
  buildCalendarEventPayload,
  buildCancelledEventPayload,
  buildCompletedEventPayload,
  type EntityContext,
} from "@/lib/google-calendar/event-builder";
import { logGoogleCalendarSafe } from "@/lib/google-calendar/oauth";
import type {
  CalendarEntityKind,
  CalendarSyncOperation,
  GoogleCalendarConnectionRow,
} from "@/lib/google-calendar/types";
import {
  ensureGoogleAccessToken,
  getActiveGoogleCalendarConnection,
  markSyncInProgress,
  recordConnectionSyncError,
  recordConnectionSyncSuccess,
  updateConnectionSyncToken,
} from "./connection.service";
import {
  getExternalEventMapping,
  markExternalEventDeleted,
  markExternalEventError,
  upsertExternalEventMapping,
} from "./external-events.service";
import { pullGoogleCalendarEvents } from "./inbound-sync.service";

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
): Promise<{ context: EntityContext; ownerUserId: string } | null> {
  const supabase = await createServerClient();

  if (kind === "visit") {
    const { data, error } = await supabase
      .from("visits")
      .select("id,user_id,scheduled_at,notes,status,companies(name)")
      .eq("id", entityId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as {
      id: string;
      user_id: string;
      scheduled_at: string;
      notes: string | null;
      status: string;
      companies: CompanyRelation;
    };
    const companyName = relationCompanyName(row.companies);

    return {
      ownerUserId: row.user_id,
      context: {
        kind,
        entityId: row.id,
        title: companyName ? `Visita ${companyName}` : "Visita pianificata",
        notes: row.notes,
        scheduledAt: row.scheduled_at,
        companyName,
        statusLabel: VISIT_STATUS_LABELS[row.status] ?? row.status,
      },
    };
  }

  if (kind === "follow_up") {
    const { data, error } = await supabase
      .from("follow_ups")
      .select(
        "id,user_id,scheduled_at,postponed_to,description,status,activity_type,companies(name)"
      )
      .eq("id", entityId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as {
      id: string;
      user_id: string;
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
      ownerUserId: row.user_id,
      context: {
        kind,
        entityId: row.id,
        title: getDefaultContactHistoryTitle(row.activity_type as ContactHistoryType),
        notes: row.description,
        scheduledAt,
        companyName,
        statusLabel: FOLLOW_UP_STATUS_LABELS[row.status] ?? row.status,
      },
    };
  }

  const { data, error } = await supabase
    .from("agenda_reminders")
    .select("id,user_id,title,notes,scheduled_at,status,companies(name)")
    .eq("id", entityId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    id: string;
    user_id: string;
    title: string;
    notes: string | null;
    scheduled_at: string;
    status: string;
    companies: CompanyRelation;
  };
  const companyName = relationCompanyName(row.companies);

  return {
    ownerUserId: row.user_id,
    context: {
      kind,
      entityId: row.id,
      title: row.title,
      notes: row.notes,
      scheduledAt: row.scheduled_at,
      companyName,
      statusLabel: FOLLOW_UP_STATUS_LABELS[row.status] ?? row.status,
    },
  };
}

async function upsertGoogleCalendarEvent(
  accessToken: string,
  connection: { calendar_id: string; user_id: string },
  kind: CalendarEntityKind,
  entityId: string,
  payload: ReturnType<typeof buildPayloadForOperation>,
  entityRef: string,
  mapping: Awaited<ReturnType<typeof getExternalEventMapping>>
): Promise<void> {
  if (mapping?.google_event_id && mapping.sync_status !== "deleted") {
    try {
      await updateGoogleCalendarEvent(
        accessToken,
        mapping.google_calendar_id,
        mapping.google_event_id,
        payload,
        entityRef
      );

      await upsertExternalEventMapping({
        userId: connection.user_id,
        kind,
        entityId,
        googleEventId: mapping.google_event_id,
        googleCalendarId: mapping.google_calendar_id,
        syncStatus: "synced",
      });
      return;
    } catch (updateError) {
      if (!isGoogleCalendarEventMissingError(updateError)) {
        throw updateError;
      }
    }
  }

  const created = await createGoogleCalendarEvent(
    accessToken,
    connection.calendar_id,
    payload,
    entityRef
  );

  await upsertExternalEventMapping({
    userId: connection.user_id,
    kind,
    entityId,
    googleEventId: created.id,
    googleCalendarId: connection.calendar_id,
    syncStatus: "synced",
  });
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

async function withAccessTokenRetry<T>(
  connection: GoogleCalendarConnectionRow,
  run: (accessToken: string, active: GoogleCalendarConnectionRow) => Promise<T>
): Promise<T> {
  let tokenResult = await ensureGoogleAccessToken(connection);
  if (tokenResult.error) {
    throw new Error(tokenResult.error);
  }

  try {
    return await run(tokenResult.accessToken, tokenResult.connection);
  } catch (error) {
    if (!isGoogleCalendarUnauthorizedError(error)) {
      throw error;
    }

    // Un solo retry dopo force refresh — niente loop infinito.
    tokenResult = await ensureGoogleAccessToken(tokenResult.connection, {
      forceRefresh: true,
    });
    if (tokenResult.error) {
      throw new Error(tokenResult.error);
    }
    return run(tokenResult.accessToken, tokenResult.connection);
  }
}

export async function syncCalendarEntity(
  kind: CalendarEntityKind,
  entityId: string,
  operation: CalendarSyncOperation
): Promise<void> {
  const actingUser = await getCurrentUser();
  if (!actingUser) {
    return;
  }

  const loaded = await loadEntityContext(kind, entityId);
  if (!loaded) {
    return;
  }

  const { context, ownerUserId } = loaded;
  if (ownerUserId !== actingUser.id) {
    return;
  }

  const connection = await getActiveGoogleCalendarConnection();
  if (!connection) {
    return;
  }

  try {
    await withAccessTokenRetry(connection, async (accessToken, activeConnection) => {
      const entityRef = buildEntityRef(kind, entityId);
      const mapping = await getExternalEventMapping(activeConnection.user_id, kind, entityId);

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

      if (operation === "upsert" || operation === "complete") {
        await upsertGoogleCalendarEvent(
          accessToken,
          activeConnection,
          kind,
          entityId,
          payload,
          entityRef,
          mapping
        );
      }

      await recordConnectionSyncSuccess(activeConnection.user_id);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sincronizzazione Google Calendar non riuscita.";

    await recordConnectionSyncError(connection.user_id, message);
    await markExternalEventError(connection.user_id, kind, entityId, message);
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
    logGoogleCalendarSafe("error", "sync_entity_failed", {
      kind,
      entityId,
      operation,
    });
    console.error("[calendar-sync]", kind, entityId, operation, error instanceof Error ? error.message : "error");
  }
}

/** Sync manuale bidirezionale: verifica token + pull inbound Google → Agenda. */
export async function runFullCalendarSyncNow(): Promise<{
  success: boolean;
  message: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "Utente non autenticato." };
  }

  const connection = await getActiveGoogleCalendarConnection();
  if (!connection) {
    return {
      success: false,
      message: "Google Calendar non collegato. Collega l'account dalle Impostazioni.",
    };
  }

  await markSyncInProgress(connection.user_id, true);

  try {
    const result = await withAccessTokenRetry(connection, async (accessToken, active) => {
      const pull = await pullGoogleCalendarEvents({
        accessToken,
        connection: active,
      });

      if (pull.error) {
        throw new Error(pull.error);
      }

      if (pull.nextSyncToken) {
        await updateConnectionSyncToken(active.user_id, pull.nextSyncToken);
      }

      return pull;
    });

    await recordConnectionSyncSuccess(connection.user_id);
    logGoogleCalendarSafe("info", "full_sync_ok", {
      userId: connection.user_id,
      imported: result.imported,
    });

    return {
      success: true,
      message: `Sincronizzazione completata (${result.imported} eventi Google aggiornati).`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sincronizzazione Google Calendar non riuscita.";
    await recordConnectionSyncError(connection.user_id, message);
    return { success: false, message };
  } finally {
    await markSyncInProgress(connection.user_id, false);
  }
}

export async function listAgendaCalendarSyncStatuses(
  items: Array<{
    kind: CalendarEntityKind;
    entityId: string;
    compositeId: string;
    ownerUserId: string;
  }>
): Promise<Record<string, string>> {
  if (items.length === 0) {
    return {};
  }

  const entityIds = [...new Set(items.map((item) => item.entityId))];
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("calendar_external_events")
    .select("user_id,entity_kind,entity_id,sync_status")
    .in("entity_id", entityIds);

  if (error || !data) {
    return {};
  }

  const byEntity = new Map<string, string>();
  for (const row of data as Array<{
    user_id: string;
    entity_kind: CalendarEntityKind;
    entity_id: string;
    sync_status: string;
  }>) {
    byEntity.set(`${row.user_id}:${row.entity_kind}:${row.entity_id}`, row.sync_status);
  }

  const result: Record<string, string> = {};
  for (const item of items) {
    const status = byEntity.get(`${item.ownerUserId}:${item.kind}:${item.entityId}`);
    if (status) {
      result[item.compositeId] = status;
    }
  }

  return result;
}
