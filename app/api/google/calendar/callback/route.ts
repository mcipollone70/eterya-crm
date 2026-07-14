import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import {
  getActiveGoogleCalendarConnection,
  saveGoogleCalendarConnection,
} from "@/features/calendar-sync/services/connection.service";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-calendar/constants";
import {
  assertGoogleCalendarEnvConfigured,
  getAppBaseUrl,
  getGoogleOAuthRedirectUri,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar/env";
import {
  exchangeGoogleAuthCode,
  fetchGoogleUserEmail,
  tokenExpiresAt,
} from "@/lib/google-calendar/oauth";

function redirectToSettings(params: Record<string, string>) {
  const base = getAppBaseUrl();
  const url = new URL("/settings", base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const base = getAppBaseUrl();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return redirectToSettings({
      google_calendar: "error",
      message: `Autorizzazione Google rifiutata (${oauthError}).`,
    });
  }

  if (!code?.trim() || !state?.trim()) {
    return redirectToSettings({
      google_calendar: "error",
      message: "Parametri OAuth mancanti.",
    });
  }

  if (!isGoogleCalendarConfigured()) {
    return redirectToSettings({
      google_calendar: "error",
      message: "Integrazione Google non configurata nel server.",
    });
  }

  try {
    assertGoogleCalendarEnvConfigured();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Configurazione Google Calendar non valida.";
    return redirectToSettings({ google_calendar: "error", message });
  }

  const expectedRedirectUri = getGoogleOAuthRedirectUri();
  if (!expectedRedirectUri) {
    return redirectToSettings({
      google_calendar: "error",
      message: "GOOGLE_OAUTH_REDIRECT_URI non configurato.",
    });
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);

  if (!savedState || savedState !== state) {
    return redirectToSettings({
      google_calendar: "error",
      message: "Stato OAuth non valido. Riprova il collegamento.",
    });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", base));
  }

  try {
    const token = await exchangeGoogleAuthCode(code);

    if (!token.access_token) {
      return redirectToSettings({
        google_calendar: "error",
        message: "Risposta Google incompleta: access_token mancante.",
      });
    }

    const existing = await getActiveGoogleCalendarConnection();
    const refreshToken = token.refresh_token ?? existing?.refresh_token ?? null;

    if (!refreshToken) {
      return redirectToSettings({
        google_calendar: "error",
        message:
          "Google non ha restituito refresh_token. Revoca l'accesso a Eterya CRM dal tuo account Google e ricollega.",
      });
    }

    const googleEmail = await fetchGoogleUserEmail(token.access_token, token.id_token);

    const { error } = await saveGoogleCalendarConnection({
      googleEmail,
      accessToken: token.access_token,
      refreshToken,
      tokenExpiresAt: tokenExpiresAt(token.expires_in),
    });

    if (error) {
      return redirectToSettings({
        google_calendar: "error",
        message: error,
      });
    }

    return redirectToSettings({
      google_calendar: "connected",
      message: `Google Calendar collegato (${googleEmail}).`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Collegamento Google Calendar non riuscito.";
    return redirectToSettings({
      google_calendar: "error",
      message,
    });
  }
}
