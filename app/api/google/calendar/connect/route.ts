import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-calendar/constants";
import {
  assertGoogleCalendarEnvConfigured,
  getAppBaseUrl,
  getGoogleOAuthRedirectUri,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar/env";
import { buildGoogleCalendarAuthUrl, generateOAuthState } from "@/lib/google-calendar/oauth";

export async function GET() {
  const base = getAppBaseUrl();

  try {
    if (!isGoogleCalendarConfigured()) {
      return NextResponse.redirect(
        new URL(
          "/settings?google_calendar=error&message=Integrazione+Google+non+configurata+nel+server",
          base
        )
      );
    }

    assertGoogleCalendarEnvConfigured();

    const redirectUri = getGoogleOAuthRedirectUri();
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

    const state = generateOAuthState();
    const cookieStore = await cookies();
    cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    const authUrl = buildGoogleCalendarAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Avvio collegamento Google Calendar non riuscito.";
    return NextResponse.redirect(
      new URL(
        `/settings?google_calendar=error&message=${encodeURIComponent(message)}`,
        base
      )
    );
  }
}
