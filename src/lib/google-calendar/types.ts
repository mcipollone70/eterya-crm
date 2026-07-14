export type CalendarEntityKind = "visit" | "follow_up" | "reminder";

export type CalendarSyncStatus = "synced" | "pending" | "error" | "deleted";

export type CalendarSyncOperation = "upsert" | "complete" | "cancel";

export interface GoogleCalendarConnectionRow {
  user_id: string;
  google_email: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  calendar_id: string;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
  connected_at: string;
  updated_at: string;
}

export interface CalendarExternalEventRow {
  id: string;
  user_id: string;
  entity_kind: CalendarEntityKind;
  entity_id: string;
  google_event_id: string;
  google_calendar_id: string;
  sync_status: CalendarSyncStatus;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleCalendarConnectionView {
  connected: boolean;
  configured: boolean;
  googleEmail: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  connectedAt: string | null;
  needsReconnect: boolean;
}

export interface CalendarEventPayload {
  summary: string;
  description: string;
  startAt: string;
  endAt: string;
  status?: "confirmed" | "cancelled";
}

export interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export interface ValidatedGoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  token_type?: string;
}

export interface GoogleOpenIdUserInfo {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleCalendarEventResponse {
  id: string;
  status?: string;
  htmlLink?: string;
}
