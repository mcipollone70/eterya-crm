import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import {
  describeDbError,
  isOptionalIntegrationUnavailableError,
} from "@/lib/supabase/errors";
import {
  GoogleCalendarApiError,
  isCrmManagedGoogleEvent,
  listGoogleCalendarEvents,
  parseGoogleEventBounds,
} from "@/lib/google-calendar/api-client";
import { logGoogleCalendarSafe } from "@/lib/google-calendar/oauth";
import type {
  CalendarGoogleEventRow,
  GoogleCalendarConnectionRow,
  GoogleCalendarEventResponse,
} from "@/lib/google-calendar/types";
import { resolveAgendaRange } from "@/lib/agenda/calendar";

function isGoneSyncTokenError(error: unknown): boolean {
  return error instanceof GoogleCalendarApiError && error.status === 410;
}

function mapGoogleEventToRow(
  userId: string,
  calendarId: string,
  event: GoogleCalendarEventResponse,
  seenAt: string
): Omit<CalendarGoogleEventRow, "id" | "created_at" | "updated_at"> | null {
  if (!event.id || event.status === "cancelled") {
    return null;
  }

  const bounds = parseGoogleEventBounds(event);
  if (!bounds) {
    return null;
  }

  return {
    user_id: userId,
    google_event_id: event.id,
    google_calendar_id: calendarId,
    summary: (event.summary ?? "(Senza titolo)").slice(0, 500),
    description: event.description?.slice(0, 4000) ?? null,
    start_at: bounds.startAt,
    end_at: bounds.endAt,
    all_day: bounds.allDay,
    status: event.status ?? null,
    html_link: event.htmlLink ?? null,
    recurring_event_id: event.recurringEventId ?? null,
    is_crm_managed: isCrmManagedGoogleEvent(event),
    last_seen_at: seenAt,
  };
}

/**
 * Importa eventi Google → calendar_google_events (dedupe per event_id+calendar_id).
 * Esclude dalla Agenda quelli CRM-managed (già presenti come visita/follow-up/promemoria).
 * Non converte automaticamente in entità CRM.
 */
export async function pullGoogleCalendarEvents(input: {
  accessToken: string;
  connection: GoogleCalendarConnectionRow;
  viewDate?: string;
}): Promise<{ imported: number; error: string | null; nextSyncToken: string | null }> {
  const calendarId = input.connection.calendar_id || "primary";
  const seenAt = new Date().toISOString();
  const range = resolveAgendaRange("month", input.viewDate ?? new Date().toISOString().slice(0, 10));

  // Finestra ampia: mese corrente ± 1 mese
  const timeMin = new Date(range.startIso);
  timeMin.setMonth(timeMin.getMonth() - 1);
  const timeMax = new Date(range.endIso);
  timeMax.setMonth(timeMax.getMonth() + 1);

  const collected: GoogleCalendarEventResponse[] = [];
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  let useSyncToken = Boolean(input.connection.sync_token);

  const fetchPage = async (syncToken: string | null | undefined) =>
    listGoogleCalendarEvents({
      accessToken: input.accessToken,
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      syncToken: syncToken || null,
      pageToken,
    });

  try {
    let guard = 0;
    while (guard < 20) {
      guard += 1;
      let page;
      try {
        page = await fetchPage(useSyncToken ? input.connection.sync_token : null);
      } catch (error) {
        if (useSyncToken && isGoneSyncTokenError(error)) {
          useSyncToken = false;
          pageToken = null;
          continue;
        }
        throw error;
      }

      for (const item of page.items ?? []) {
        collected.push(item);
      }

      if (page.nextPageToken) {
        pageToken = page.nextPageToken;
        continue;
      }

      nextSyncToken = page.nextSyncToken ?? null;
      break;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lettura eventi Google non riuscita.";
    return { imported: 0, error: message, nextSyncToken: null };
  }

  const supabase = await createServerClient();
  let imported = 0;

  for (const event of collected) {
    if (event.status === "cancelled" && event.id) {
      await supabase
        .from("calendar_google_events")
        .delete()
        .eq("user_id", input.connection.user_id)
        .eq("google_calendar_id", calendarId)
        .eq("google_event_id", event.id);
      continue;
    }

    const row = mapGoogleEventToRow(input.connection.user_id, calendarId, event, seenAt);
    if (!row || row.is_crm_managed) {
      // CRM-managed: non mostrare doppione; eventualmente rimuovi import precedente
      if (row?.is_crm_managed && event.id) {
        await supabase
          .from("calendar_google_events")
          .delete()
          .eq("user_id", input.connection.user_id)
          .eq("google_calendar_id", calendarId)
          .eq("google_event_id", event.id);
      }
      continue;
    }

    const { error } = await supabase.from("calendar_google_events").upsert(
      {
        user_id: row.user_id,
        google_event_id: row.google_event_id,
        google_calendar_id: row.google_calendar_id,
        summary: row.summary,
        description: row.description,
        start_at: row.start_at,
        end_at: row.end_at,
        all_day: row.all_day,
        status: row.status,
        html_link: row.html_link,
        recurring_event_id: row.recurring_event_id,
        is_crm_managed: false,
        last_seen_at: row.last_seen_at,
      },
      { onConflict: "user_id,google_calendar_id,google_event_id" }
    );

    if (error) {
      if (isOptionalIntegrationUnavailableError(error)) {
        return {
          imported: 0,
          error:
            "Tabella calendar_google_events non disponibile. Applica la migrazione 20260716_google_calendar_bidirectional.sql.",
          nextSyncToken: null,
        };
      }
      return { imported, error: describeDbError(error), nextSyncToken: null };
    }

    imported += 1;
  }

  logGoogleCalendarSafe("info", "inbound_pull_done", {
    userId: input.connection.user_id,
    imported,
  });

  return { imported, error: null, nextSyncToken };
}

export async function listGoogleAgendaEvents(input: {
  userId: string | null;
  startIso: string;
  endIso: string;
}): Promise<{ data: CalendarGoogleEventRow[]; error: string | null }> {
  const supabase = await createServerClient();
  let query = supabase
    .from("calendar_google_events")
    .select("*")
    .eq("is_crm_managed", false)
    .gte("start_at", input.startIso)
    .lte("start_at", input.endIso)
    .order("start_at", { ascending: true })
    .limit(500);

  if (input.userId) {
    query = query.eq("user_id", input.userId);
  }

  const { data, error } = await query;

  if (error) {
    if (isOptionalIntegrationUnavailableError(error)) {
      return { data: [], error: null };
    }
    return { data: [], error: describeDbError(error) };
  }

  return { data: (data as CalendarGoogleEventRow[]) ?? [], error: null };
}
