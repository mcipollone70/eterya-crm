export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

/** Scope OAuth richiesti: identità (email) + calendario. */
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  GOOGLE_CALENDAR_SCOPE,
] as const;

export const GOOGLE_OAUTH_SCOPE = GOOGLE_OAUTH_SCOPES.join(" ");

export const GOOGLE_OAUTH_STATE_COOKIE = "google_calendar_oauth_state";

export const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
/** Endpoint OpenID Connect (richiede scope openid + email). */
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export const DEFAULT_EVENT_DURATION_MINUTES = 60;

export const CRM_SOURCE_EXTENDED_PROPERTY = "eterya_crm_entity";
