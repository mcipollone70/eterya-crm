import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import {
  getGoogleCalendarConfigView,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar/env";
import { refreshGoogleAccessToken, tokenExpiresAt } from "@/lib/google-calendar/oauth";
import type {
  GoogleCalendarConnectionRow,
  GoogleCalendarConnectionView,
} from "@/lib/google-calendar/types";

function mapConnectionView(
  row: GoogleCalendarConnectionRow | null,
  configured: boolean
): GoogleCalendarConnectionView {
  if (!row) {
    return {
      connected: false,
      configured,
      googleEmail: null,
      syncEnabled: false,
      lastSyncAt: null,
      lastSyncError: null,
      connectedAt: null,
      needsReconnect: false,
    };
  }

  const expired = new Date(row.token_expires_at).getTime() <= Date.now();
  const needsReconnect = !row.sync_enabled || (expired && !row.refresh_token);

  return {
    connected: row.sync_enabled,
    configured,
    googleEmail: row.google_email,
    syncEnabled: row.sync_enabled,
    lastSyncAt: row.last_sync_at,
    lastSyncError: row.last_sync_error,
    connectedAt: row.connected_at,
    needsReconnect,
  };
}

export async function getGoogleCalendarConnectionView(): Promise<GoogleCalendarConnectionView> {
  const configured = isGoogleCalendarConfigured();
  const user = await getCurrentUser();
  if (!user || !configured) {
    return mapConnectionView(null, configured);
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return {
      ...mapConnectionView(null, configured),
      lastSyncError: describeDbError(error),
    };
  }

  return mapConnectionView((data as GoogleCalendarConnectionRow | null) ?? null, configured);
}

export async function saveGoogleCalendarConnection(input: {
  googleEmail: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string;
}): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("google_calendar_connections").upsert(
    {
      user_id: user.id,
      google_email: input.googleEmail,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      token_expires_at: input.tokenExpiresAt,
      calendar_id: "primary",
      sync_enabled: true,
      last_sync_error: null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return { error: describeDbError(error) };
}

export async function disconnectGoogleCalendar(): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();
  const { error: eventsError } = await supabase
    .from("calendar_external_events")
    .delete()
    .eq("user_id", user.id);

  if (eventsError) {
    return { error: describeDbError(eventsError) };
  }

  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", user.id);

  return { error: describeDbError(error) };
}

export async function getActiveGoogleCalendarConnection(): Promise<GoogleCalendarConnectionRow | null> {
  const user = await getCurrentUser();
  if (!user || !isGoogleCalendarConfigured()) {
    return null;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("sync_enabled", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as GoogleCalendarConnectionRow;
}

export async function ensureGoogleAccessToken(
  connection: GoogleCalendarConnectionRow
): Promise<{ accessToken: string; connection: GoogleCalendarConnectionRow; error: string | null }> {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const stillValid = expiresAt > Date.now() + 60_000;

  if (stillValid) {
    return { accessToken: connection.access_token, connection, error: null };
  }

  if (!connection.refresh_token) {
    return {
      accessToken: connection.access_token,
      connection,
      error: "Token Google scaduto. Ricollega Google Calendar dalle Impostazioni.",
    };
  }

  try {
    const token = await refreshGoogleAccessToken(connection.refresh_token);
    const supabase = await createServerClient();
    const nextExpiresAt = tokenExpiresAt(token.expires_in);

    const { data, error } = await supabase
      .from("google_calendar_connections")
      .update({
        access_token: token.access_token,
        token_expires_at: nextExpiresAt,
        last_sync_error: null,
      })
      .eq("user_id", connection.user_id)
      .select("*")
      .single();

    if (error || !data) {
      return {
        accessToken: connection.access_token,
        connection,
        error: describeDbError(error),
      };
    }

    return {
      accessToken: token.access_token,
      connection: data as GoogleCalendarConnectionRow,
      error: null,
    };
  } catch (refreshError) {
    const message =
      refreshError instanceof Error
        ? refreshError.message
        : "Refresh token Google non riuscito.";

    const supabase = await createServerClient();
    await supabase
      .from("google_calendar_connections")
      .update({ last_sync_error: message })
      .eq("user_id", connection.user_id);

    return { accessToken: connection.access_token, connection, error: message };
  }
}

export async function recordConnectionSyncError(
  userId: string,
  message: string
): Promise<void> {
  const supabase = await createServerClient();
  await supabase
    .from("google_calendar_connections")
    .update({ last_sync_error: message })
    .eq("user_id", userId);
}

export async function recordConnectionSyncSuccess(userId: string): Promise<void> {
  const supabase = await createServerClient();
  await supabase
    .from("google_calendar_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
    })
    .eq("user_id", userId);
}

export function getGoogleCalendarPublicConfig() {
  return getGoogleCalendarConfigView();
}
