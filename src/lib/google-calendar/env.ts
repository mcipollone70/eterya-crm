import "server-only";

export const GOOGLE_CLIENT_ID_ENV = "GOOGLE_CLIENT_ID";
export const GOOGLE_CLIENT_SECRET_ENV = "GOOGLE_CLIENT_SECRET";
export const GOOGLE_OAUTH_REDIRECT_URI_ENV = "GOOGLE_OAUTH_REDIRECT_URI";
export const APP_URL_ENV = "NEXT_PUBLIC_APP_URL";

const CALLBACK_PATH = "/api/google/calendar/callback";

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export function getGoogleClientId(): string | null {
  const value = process.env[GOOGLE_CLIENT_ID_ENV];
  return value?.trim() || null;
}

export function getGoogleClientSecret(): string | null {
  const value = process.env[GOOGLE_CLIENT_SECRET_ENV];
  return value?.trim() || null;
}

export function getGoogleOAuthRedirectUriExplicit(): string | null {
  const value = process.env[GOOGLE_OAUTH_REDIRECT_URI_ENV];
  return value?.trim() || null;
}

/**
 * Resolve OAuth redirect URI.
 * Priority: explicit GOOGLE_OAUTH_REDIRECT_URI → request origin → APP_URL → VERCEL_URL.
 * Allows localhost port flexibility when the URI is registered in Google Cloud Console.
 */
export function resolveGoogleOAuthRedirectUri(requestUrl?: string | null): string | null {
  const explicit = getGoogleOAuthRedirectUriExplicit();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const fromRequest = originFromUrl(requestUrl);
  if (fromRequest) {
    return `${fromRequest}${CALLBACK_PATH}`;
  }

  const appBase = getAppBaseUrl();
  if (appBase) {
    return `${appBase}${CALLBACK_PATH}`;
  }

  return null;
}

/** @deprecated Prefer resolveGoogleOAuthRedirectUri — kept for callers that expect the env getter. */
export function getGoogleOAuthRedirectUri(): string | null {
  return resolveGoogleOAuthRedirectUri();
}

function originFromUrl(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getAppBaseUrl(requestUrl?: string | null): string {
  const fromEnv = process.env[APP_URL_ENV]?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const fromRequest = originFromUrl(requestUrl);
  if (fromRequest) {
    return fromRequest;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return "http://localhost:3000";
}

export function getGoogleCalendarConfigView(requestUrl?: string | null): {
  configured: boolean;
  redirectUri: string | null;
} {
  return {
    configured: isGoogleCalendarConfigured(),
    redirectUri: resolveGoogleOAuthRedirectUri(requestUrl),
  };
}

/** Verifica che tutte le variabili OAuth necessarie siano presenti (senza esporre i valori). */
export function assertGoogleCalendarEnvConfigured(requestUrl?: string | null): void {
  const missing: string[] = [];

  if (!getGoogleClientId()) {
    missing.push(GOOGLE_CLIENT_ID_ENV);
  }
  if (!getGoogleClientSecret()) {
    missing.push(GOOGLE_CLIENT_SECRET_ENV);
  }
  if (!resolveGoogleOAuthRedirectUri(requestUrl)) {
    missing.push(`${GOOGLE_OAUTH_REDIRECT_URI_ENV} (o ${APP_URL_ENV})`);
  }

  if (missing.length > 0) {
    throw new Error(
      `Google Calendar OAuth non configurato. Variabili mancanti: ${missing.join(", ")}.`
    );
  }
}
