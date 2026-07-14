import "server-only";

export const GOOGLE_CLIENT_ID_ENV = "GOOGLE_CLIENT_ID";
export const GOOGLE_CLIENT_SECRET_ENV = "GOOGLE_CLIENT_SECRET";
export const GOOGLE_OAUTH_REDIRECT_URI_ENV = "GOOGLE_OAUTH_REDIRECT_URI";
export const APP_URL_ENV = "NEXT_PUBLIC_APP_URL";

export function isGoogleCalendarConfigured(): boolean {
  const clientId = process.env[GOOGLE_CLIENT_ID_ENV];
  const clientSecret = process.env[GOOGLE_CLIENT_SECRET_ENV];
  const redirectUri = process.env[GOOGLE_OAUTH_REDIRECT_URI_ENV];
  return Boolean(clientId?.trim() && clientSecret?.trim() && redirectUri?.trim());
}

export function getGoogleClientId(): string | null {
  const value = process.env[GOOGLE_CLIENT_ID_ENV];
  return value?.trim() || null;
}

export function getGoogleClientSecret(): string | null {
  const value = process.env[GOOGLE_CLIENT_SECRET_ENV];
  return value?.trim() || null;
}

export function getGoogleOAuthRedirectUri(): string | null {
  const value = process.env[GOOGLE_OAUTH_REDIRECT_URI_ENV];
  return value?.trim() || null;
}

export function getAppBaseUrl(): string {
  const fromEnv = process.env[APP_URL_ENV]?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export function getGoogleCalendarConfigView(): {
  configured: boolean;
  redirectUri: string | null;
} {
  return {
    configured: isGoogleCalendarConfigured(),
    redirectUri: getGoogleOAuthRedirectUri(),
  };
}

/** Verifica che tutte le variabili OAuth siano presenti (senza esporre i valori). */
export function assertGoogleCalendarEnvConfigured(): void {
  const missing: string[] = [];

  if (!getGoogleClientId()) {
    missing.push(GOOGLE_CLIENT_ID_ENV);
  }
  if (!getGoogleClientSecret()) {
    missing.push(GOOGLE_CLIENT_SECRET_ENV);
  }
  if (!getGoogleOAuthRedirectUri()) {
    missing.push(GOOGLE_OAUTH_REDIRECT_URI_ENV);
  }

  if (missing.length > 0) {
    throw new Error(
      `Google Calendar OAuth non configurato. Variabili mancanti: ${missing.join(", ")}.`
    );
  }
}
