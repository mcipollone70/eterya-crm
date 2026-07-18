import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-calendar/constants";
import {
  assertGoogleCalendarEnvConfigured,
  getAppBaseUrl,
  isGoogleCalendarConfigured,
  resolveGoogleOAuthRedirectUri,
} from "@/lib/google-calendar/env";
import {
  buildGoogleCalendarAuthUrl,
  createSignedOAuthState,
  logGoogleCalendarSafe,
} from "@/lib/google-calendar/oauth";

export async function GET(request: Request) {
  const base = getAppBaseUrl(request.url);

  try {
    if (!isGoogleCalendarConfigured()) {
      return NextResponse.redirect(
        new URL(
          "/settings?google_calendar=error&message=Integrazione+Google+non+configurata+nel+server",
          base
        )
      );
    }

    assertGoogleCalendarEnvConfigured(request.url);

    const redirectUri = resolveGoogleOAuthRedirectUri(request.url);
    if (!redirectUri?.startsWith("http")) {
      return NextResponse.redirect(
        new URL(
          "/settings?google_calendar=error&message=GOOGLE_OAUTH_REDIRECT_URI+non+valido",
          base
        )
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(new URL("/login", base));
    }

    // Sempre consent sul flusso Calendar: garantisce refresh_token + scope calendar.events.
    const forceConsent = true;

    const state = createSignedOAuthState(user.id);
    const cookieStore = await cookies();
    cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    logGoogleCalendarSafe("info", "oauth_connect_started", {
      userId: user.id,
      forceConsent,
    });

    const authUrl = buildGoogleCalendarAuthUrl(state, {
      forceConsent,
      requestUrl: request.url,
    });
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Avvio collegamento Google Calendar non riuscito.";
    logGoogleCalendarSafe("error", "oauth_connect_failed", {
      reason: message.slice(0, 120),
    });
    return NextResponse.redirect(
      new URL(
        `/settings?google_calendar=error&message=${encodeURIComponent(message)}`,
        base
      )
    );
  }
}
