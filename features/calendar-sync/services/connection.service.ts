import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  describeDbError,
  isOptionalIntegrationUnavailableError,
} from "@/lib/supabase/errors";
import {
  getGoogleCalendarConfigView,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar/env";
import {
  hasRequiredCalendarScope,
  logGoogleCalendarSafe,
  refreshGoogleAccessToken,
  tokenExpiresAt,
} from "@/lib/google-calendar/oauth";
import {
  isGoogleCalendarAuthOrScopeError,
  isGoogleCalendarTemporaryError,
  toUserFacingGoogleSyncError,
} from "@/lib/google-calendar/sync-errors";
import type {
  GoogleCalendarConnectionRow,
  GoogleCalendarConnectionView,
} from "@/lib/google-calendar/types";

const SYNC_IN_PROGRESS_TTL_MS = 2 * 60 * 1000;

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
      syncInProgress: false,
      temporaryError: false,
    };
  }

  const expired = new Date(row.token_expires_at).getTime() <= Date.now();
  const lastSyncError = toUserFacingGoogleSyncError(row.last_sync_error);
  const authOrScopeError = isGoogleCalendarAuthOrScopeError(row.last_sync_error);
  const scopeMissing =
    typeof row.granted_scopes === "string" &&
    row.granted_scopes.length > 0 &&
    !hasRequiredCalendarScope(row.granted_scopes);

  const needsReconnect =
    (expired && !row.refresh_token) || authOrScopeError || scopeMissing;

  const syncInProgress =
    Boolean(row.sync_in_progress_at) &&
    Date.now() - new Date(row.sync_in_progress_at!).getTime() < SYNC_IN_PROGRESS_TTL_MS;

  const temporaryError =
    !needsReconnect && isGoogleCalendarTemporaryError(row.last_sync_error);

  return {
    connected: row.sync_enabled,
    configured,
    googleEmail: row.google_email,
    syncEnabled: row.sync_enabled,
    lastSyncAt: row.last_sync_at,
    lastSyncError,
    connectedAt: row.connected_at,
    needsReconnect,
    syncInProgress,
    temporaryError,
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
    if (isOptionalIntegrationUnavailableError(error)) {
      return mapConnectionView(null, false);
    }
    return mapConnectionView(null, configured);
  }

  return mapConnectionView((data as GoogleCalendarConnectionRow | null) ?? null, configured);
}

export async function saveGoogleCalendarConnection(input: {
  googleEmail: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string;
  grantedScopes?: string | null;
}): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();
  const basePayload = {
    user_id: user.id,
    google_email: input.googleEmail,
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    token_expires_at: input.tokenExpiresAt,
    calendar_id: "primary",
    sync_enabled: true,
    last_sync_error: null as string | null,
    connected_at: new Date().toISOString(),
  };

  const withScopes =
    input.grantedScopes != null
      ? { ...basePayload, granted_scopes: input.grantedScopes }
      : basePayload;

  const { error } = await supabase.from("google_calendar_connections").upsert(withScopes, {
    onConflict: "user_id",
  });

  if (error && /granted_scopes|sync_token|sync_in_progress/i.test(error.message ?? "")) {
    const retry = await supabase.from("google_calendar_connections").upsert(basePayload, {
      onConflict: "user_id",
    });
    return { error: describeDbError(retry.error) };
  }

  logGoogleCalendarSafe("info", "connection_saved", {
    userId: user.id,
    email: input.googleEmail,
  });

  return { error: describeDbError(error) };
}

export async function disconnectGoogleCalendar(): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();

  const { error: googleEventsError } = await supabase
    .from("calendar_google_events")
    .delete()
    .eq("user_id", user.id);

  if (
    googleEventsError &&
    !isOptionalIntegrationUnavailableError(googleEventsError) &&
    !/does not exist|relation|schema cache|Could not find the table/i.test(
      googleEventsError.message ?? ""
    )
  ) {
    // Tabella inbound opzionale: non bloccare lo scollegamento.
  }

  const { error: eventsError } = await supabase
    .from("calendar_external_events")
    .delete()
    .eq("user_id", user.id);

  if (eventsError && !isOptionalIntegrationUnavailableError(eventsError)) {
    return { error: describeDbError(eventsError) };
  }

  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", user.id);

  logGoogleCalendarSafe("info", "connection_disconnected", { userId: user.id });

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

/**
 * Garantisce un access token valido. Aggiorna in modo condizionale (token_expires_at
 * precedente) per ridurre race; preserva refresh_token se Google lo omette.
 */
export async function ensureGoogleAccessToken(
  connection: GoogleCalendarConnectionRow,
  options?: { forceRefresh?: boolean }
): Promise<{ accessToken: string; connection: GoogleCalendarConnectionRow; error: string | null }> {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const stillValid = !options?.forceRefresh && expiresAt > Date.now() + 60_000;

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
    const previousExpiresAt = connection.token_expires_at;

    const baseUpdate = {
      access_token: token.access_token,
      token_expires_at: nextExpiresAt,
      last_sync_error: null as string | null,
      ...(token.refresh_token ? { refresh_token: token.refresh_token } : {}),
    };

    const withScopes = token.scope
      ? { ...baseUpdate, granted_scopes: token.scope }
      : baseUpdate;

    let { data, error } = await supabase
      .from("google_calendar_connections")
      .update(withScopes)
      .eq("user_id", connection.user_id)
      .eq("token_expires_at", previousExpiresAt)
      .select("*")
      .maybeSingle();

    if (error && /granted_scopes/i.test(error.message ?? "")) {
      const retry = await supabase
        .from("google_calendar_connections")
        .update(baseUpdate)
        .eq("user_id", connection.user_id)
        .eq("token_expires_at", previousExpiresAt)
        .select("*")
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    // Race: altro processo ha già aggiornato → rileggi
    if (!error && !data) {
      const reread = await supabase
        .from("google_calendar_connections")
        .select("*")
        .eq("user_id", connection.user_id)
        .maybeSingle();
      if (reread.data) {
        const row = reread.data as GoogleCalendarConnectionRow;
        return { accessToken: row.access_token, connection: row, error: null };
      }
    }

    if (error || !data) {
      return {
        accessToken: connection.access_token,
        connection,
        error: describeDbError(error) ?? "Aggiornamento token Google non riuscito.",
      };
    }

    logGoogleCalendarSafe("info", "token_refreshed", { userId: connection.user_id });

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

    logGoogleCalendarSafe("warn", "token_refresh_failed", {
      userId: connection.user_id,
      reason: isGoogleCalendarAuthOrScopeError(message) ? "auth" : "other",
    });

    return { accessToken: connection.access_token, connection, error: message };
  }
}

export async function markSyncInProgress(userId: string, inProgress: boolean): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("google_calendar_connections")
    .update({
      sync_in_progress_at: inProgress ? new Date().toISOString() : null,
    })
    .eq("user_id", userId);

  if (error && /sync_in_progress_at/i.test(error.message ?? "")) {
    // Colonna non ancora migrate: ignora
    return;
  }
}

export async function recordConnectionSyncError(
  userId: string,
  message: string
): Promise<void> {
  const supabase = await createServerClient();
  await supabase
    .from("google_calendar_connections")
    .update({
      last_sync_error: toUserFacingGoogleSyncError(message) ?? message,
      sync_in_progress_at: null,
    })
    .eq("user_id", userId);
}

export async function recordConnectionSyncSuccess(userId: string): Promise<void> {
  const supabase = await createServerClient();
  await supabase
    .from("google_calendar_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
      sync_in_progress_at: null,
    })
    .eq("user_id", userId);
}

export async function updateConnectionSyncToken(
  userId: string,
  syncToken: string | null
): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("google_calendar_connections")
    .update({ sync_token: syncToken })
    .eq("user_id", userId);

  if (error && /sync_token/i.test(error.message ?? "")) {
    return;
  }
}

export function getGoogleCalendarPublicConfig() {
  return getGoogleCalendarConfigView();
}
