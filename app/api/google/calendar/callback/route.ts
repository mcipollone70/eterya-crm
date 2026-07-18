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
  isGoogleCalendarConfigured,
  resolveGoogleOAuthRedirectUri,
} from "@/lib/google-calendar/env";
import {
  exchangeGoogleAuthCode,
  fetchGoogleUserEmail,
  logGoogleCalendarSafe,
  tokenExpiresAt,
  verifySignedOAuthState,
} from "@/lib/google-calendar/oauth";

function redirectToSettings(requestUrl: string, params: Record<string, string>) {
  const base = getAppBaseUrl(requestUrl);
  const url = new URL("/settings", base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const base = getAppBaseUrl(request.url);

  if (oauthError) {
    const denied =
      oauthError === "access_denied"
        ? "Autorizzazione Google annullata."
        : `Autorizzazione Google rifiutata (${oauthError}).`;
    logGoogleCalendarSafe("warn", "oauth_callback_denied", { error: oauthError });
    return redirectToSettings(request.url, {
      google_calendar: "error",
      message: denied,
    });
  }

  if (!code?.trim() || !state?.trim()) {
    return redirectToSettings(request.url, {
      google_calendar: "error",
      message: "Parametri OAuth mancanti (codice o stato).",
    });
  }

  if (!isGoogleCalendarConfigured()) {
    return redirectToSettings(request.url, {
      google_calendar: "error",
      message: "Integrazione Google non configurata nel server.",
    });
  }

  try {
    assertGoogleCalendarEnvConfigured(request.url);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Configurazione Google Calendar non valida.";
    return redirectToSettings(request.url, { google_calendar: "error", message });
  }

  const expectedRedirectUri = resolveGoogleOAuthRedirectUri(request.url);
  if (!expectedRedirectUri) {
    return redirectToSettings(request.url, {
      google_calendar: "error",
      message: "Redirect URI Google non risolvibile. Imposta GOOGLE_OAUTH_REDIRECT_URI.",
    });
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);

  if (!savedState || savedState !== state) {
    return redirectToSettings(request.url, {
      google_calendar: "error",
      message: "Stato OAuth non valido. Riprova il collegamento.",
    });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", base));
  }

  const stateCheck = verifySignedOAuthState(state, user.id);
  if (!stateCheck.ok) {
    return redirectToSettings(request.url, {
      google_calendar: "error",
      message: stateCheck.reason,
    });
  }

  try {
    const token = await exchangeGoogleAuthCode(code, request.url);

    if (!token.access_token) {
      return redirectToSettings(request.url, {
        google_calendar: "error",
        message: "Risposta Google incompleta: access_token mancante.",
      });
    }

    const existing = await getActiveGoogleCalendarConnection();
    const refreshToken = token.refresh_token ?? existing?.refresh_token ?? null;

    if (!refreshToken) {
      return redirectToSettings(request.url, {
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
      grantedScopes: token.scope ?? null,
    });

    if (error) {
      return redirectToSettings(request.url, {
        google_calendar: "error",
        message: error,
      });
    }

    logGoogleCalendarSafe("info", "oauth_callback_success", {
      userId: user.id,
      email: googleEmail,
    });

    return redirectToSettings(request.url, {
      google_calendar: "connected",
      message: `Google Calendar collegato (${googleEmail}).`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Collegamento Google Calendar non riuscito.";
    logGoogleCalendarSafe("error", "oauth_callback_failed", {
      userId: user.id,
      reason: message.slice(0, 120),
    });
    return redirectToSettings(request.url, {
      google_calendar: "error",
      message,
    });
  }
}
