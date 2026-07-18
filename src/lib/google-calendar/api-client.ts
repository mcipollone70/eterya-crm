import "server-only";

import {
  CRM_SOURCE_EXTENDED_PROPERTY,
  DEFAULT_EVENT_DURATION_MINUTES,
  GOOGLE_CALENDAR_API_BASE,
} from "./constants";
import type {
  CalendarEntityKind,
  CalendarEventPayload,
  GoogleCalendarEventResponse,
  GoogleCalendarEventsListResponse,
} from "./types";

export class GoogleCalendarApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GoogleCalendarApiError";
    this.status = status;
  }
}

export function isGoogleCalendarEventMissingError(error: unknown): boolean {
  return error instanceof GoogleCalendarApiError && (error.status === 404 || error.status === 410);
}

export function isGoogleCalendarUnauthorizedError(error: unknown): boolean {
  return error instanceof GoogleCalendarApiError && error.status === 401;
}

function userFacingGoogleApiFailure(action: string, status: number, body: string): string {
  const normalized = body.trim();
  if (
    status === 401 ||
    status === 403 ||
    /ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(normalized) ||
    /insufficient (authentication )?scopes?/i.test(normalized) ||
    /insufficient permission/i.test(normalized)
  ) {
    return "Permessi Google Calendar insufficienti. Ricollega l'account dalle Impostazioni.";
  }

  if (status === 404 || status === 410) {
    return `Evento Google non trovato durante ${action}.`;
  }

  if (status >= 500) {
    return `Google Calendar non ha risposto correttamente durante ${action}. Riprova tra poco.`;
  }

  return `Sincronizzazione Google Calendar non riuscita durante ${action}. Riprova o ricollega l'account dalle Impostazioni.`;
}

function calendarEventsUrl(calendarId: string, eventId?: string): string {
  const encodedCalendar = encodeURIComponent(calendarId);
  if (eventId) {
    return `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendar}/events/${encodeURIComponent(eventId)}`;
  }
  return `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendar}/events`;
}

function toGoogleEventBody(
  payload: CalendarEventPayload,
  entityRef: string
): Record<string, unknown> {
  return {
    summary: payload.summary,
    description: payload.description,
    start: {
      dateTime: payload.startAt,
      timeZone: "Europe/Rome",
    },
    end: {
      dateTime: payload.endAt,
      timeZone: "Europe/Rome",
    },
    status: payload.status ?? "confirmed",
    extendedProperties: {
      private: {
        [CRM_SOURCE_EXTENDED_PROPERTY]: entityRef,
      },
    },
  };
}

async function readErrorBody(response: Response): Promise<string> {
  return response.text().catch(() => "");
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  payload: CalendarEventPayload,
  entityRef: string
): Promise<GoogleCalendarEventResponse> {
  const response = await fetch(calendarEventsUrl(calendarId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toGoogleEventBody(payload, entityRef)),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await readErrorBody(response);
    throw new GoogleCalendarApiError(
      userFacingGoogleApiFailure("la creazione evento", response.status, text),
      response.status
    );
  }

  return (await response.json()) as GoogleCalendarEventResponse;
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  payload: CalendarEventPayload,
  entityRef: string
): Promise<GoogleCalendarEventResponse> {
  const response = await fetch(calendarEventsUrl(calendarId, eventId), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toGoogleEventBody(payload, entityRef)),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await readErrorBody(response);
    throw new GoogleCalendarApiError(
      userFacingGoogleApiFailure("l'aggiornamento evento", response.status, text),
      response.status
    );
  }

  return (await response.json()) as GoogleCalendarEventResponse;
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(calendarEventsUrl(calendarId, eventId), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 404 || response.status === 410) {
    return;
  }

  if (!response.ok) {
    const text = await readErrorBody(response);
    throw new GoogleCalendarApiError(
      userFacingGoogleApiFailure("l'eliminazione evento", response.status, text),
      response.status
    );
  }
}

export interface ListGoogleCalendarEventsInput {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
  syncToken?: string | null;
  pageToken?: string | null;
}

/**
 * Lista eventi Google. Con syncToken ignora timeMin/timeMax (API Google).
 * Gestisce eventi ricorrenti senza crash: restituisce istanze espanse (singleEvents).
 */
export async function listGoogleCalendarEvents(
  input: ListGoogleCalendarEventsInput
): Promise<GoogleCalendarEventsListResponse> {
  const url = new URL(calendarEventsUrl(input.calendarId));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("showDeleted", "true");

  if (input.syncToken) {
    url.searchParams.set("syncToken", input.syncToken);
  } else {
    url.searchParams.set("timeMin", input.timeMin);
    url.searchParams.set("timeMax", input.timeMax);
  }

  if (input.pageToken) {
    url.searchParams.set("pageToken", input.pageToken);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await readErrorBody(response);
    // 410 Gone su syncToken invalido → chiamante deve rifare full sync
    throw new GoogleCalendarApiError(
      userFacingGoogleApiFailure("la lettura eventi", response.status, text),
      response.status
    );
  }

  return (await response.json()) as GoogleCalendarEventsListResponse;
}

export function isCrmManagedGoogleEvent(event: GoogleCalendarEventResponse): boolean {
  const marker = event.extendedProperties?.private?.[CRM_SOURCE_EXTENDED_PROPERTY];
  return Boolean(marker?.trim());
}

export function buildEntityRef(kind: CalendarEntityKind, entityId: string): string {
  return `${kind}:${entityId}`;
}

export function addMinutes(isoDate: string, minutes: number): string {
  const date = new Date(isoDate);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

export function defaultEventEnd(startAt: string, minutes = DEFAULT_EVENT_DURATION_MINUTES): string {
  return addMinutes(startAt, minutes);
}

/** Interpreta start/end Google (dateTime o all-day date) in ISO, timezone Europe/Rome-safe. */
export function parseGoogleEventBounds(event: GoogleCalendarEventResponse): {
  startAt: string;
  endAt: string | null;
  allDay: boolean;
} | null {
  const startDateTime = event.start?.dateTime;
  const endDateTime = event.end?.dateTime;
  const startDate = event.start?.date;
  const endDate = event.end?.date;

  if (startDateTime) {
    const start = new Date(startDateTime);
    if (Number.isNaN(start.getTime())) {
      return null;
    }
    const end = endDateTime ? new Date(endDateTime) : null;
    return {
      startAt: start.toISOString(),
      endAt: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
      allDay: false,
    };
  }

  if (startDate) {
    // All-day: date-only → mezzanotte UTC del giorno (display Agenda usa la data)
    const start = new Date(`${startDate}T00:00:00+02:00`);
    if (Number.isNaN(start.getTime())) {
      return null;
    }
    const end = endDate ? new Date(`${endDate}T00:00:00+02:00`) : null;
    return {
      startAt: start.toISOString(),
      endAt: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
      allDay: true,
    };
  }

  return null;
}
