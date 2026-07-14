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
} from "./types";

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
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Creazione evento Google non riuscita: ${text}`);
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
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Aggiornamento evento Google non riuscito: ${text}`);
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
  });

  if (response.status === 404 || response.status === 410) {
    return;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Eliminazione evento Google non riuscita: ${text}`);
  }
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
