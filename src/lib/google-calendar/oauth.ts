import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_OAUTH_AUTHORIZE_URL,
  GOOGLE_OAUTH_SCOPE,
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_USERINFO_URL,
} from "./constants";
import {
  assertGoogleCalendarEnvConfigured,
  getGoogleClientId,
  getGoogleClientSecret,
  resolveGoogleOAuthRedirectUri,
} from "./env";
import type {
  GoogleOpenIdUserInfo,
  GoogleTokenResponse,
  ValidatedGoogleTokenResponse,
} from "./types";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export function generateOAuthState(): string {
  return randomBytes(24).toString("hex");
}

/** Stato OAuth firmato e legato all'utente autenticato (HMAC, verificabile). */
export function createSignedOAuthState(userId: string): string {
  const secret = getGoogleClientSecret();
  if (!secret) {
    throw new Error("GOOGLE_CLIENT_SECRET non configurato.");
  }

  const nonce = randomBytes(16).toString("hex");
  const exp = String(Date.now() + STATE_MAX_AGE_MS);
  const payload = `${userId}.${nonce}.${exp}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifySignedOAuthState(
  state: string,
  expectedUserId: string
): { ok: true } | { ok: false; reason: string } {
  const secret = getGoogleClientSecret();
  if (!secret) {
    return { ok: false, reason: "Secret OAuth non configurato." };
  }

  let decoded: string;
  try {
    decoded = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "Stato OAuth non decodificabile." };
  }

  const parts = decoded.split(".");
  if (parts.length !== 4) {
    return { ok: false, reason: "Stato OAuth malformato." };
  }

  const [userId, nonce, expRaw, signature] = parts;
  if (!userId || !nonce || !expRaw || !signature) {
    return { ok: false, reason: "Stato OAuth incompleto." };
  }

  if (userId !== expectedUserId) {
    return { ok: false, reason: "Stato OAuth non corrisponde all'utente autenticato." };
  }

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return { ok: false, reason: "Stato OAuth scaduto. Riprova il collegamento." };
  }

  const payload = `${userId}.${nonce}.${expRaw}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const left = Buffer.from(signature, "utf8");
    const right = Buffer.from(expected, "utf8");
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return { ok: false, reason: "Firma stato OAuth non valida." };
    }
  } catch {
    return { ok: false, reason: "Firma stato OAuth non valida." };
  }

  return { ok: true };
}

function formatGoogleOAuthError(context: string, payload: unknown): string {
  if (payload && typeof payload === "object") {
    const record = payload as GoogleTokenResponse;
    const parts = [record.error, record.error_description].filter(Boolean);
    if (parts.length > 0) {
      return `${context}: ${parts.join(" — ")}`;
    }
  }

  return `${context}. Riprova il collegamento da Impostazioni.`;
}

function parseEmailFromIdToken(idToken: string): string | null {
  const parts = idToken.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as {
      email?: string;
    };
    const email = payload.email?.trim();
    return email || null;
  } catch {
    return null;
  }
}

export function hasRequiredCalendarScope(scope: string | undefined | null): boolean {
  if (!scope?.trim()) {
    return false;
  }
  const granted = new Set(scope.split(/\s+/).filter(Boolean));
  return granted.has(GOOGLE_CALENDAR_SCOPE);
}

export function validateGoogleTokenResponse(
  token: GoogleTokenResponse
): ValidatedGoogleTokenResponse {
  const accessToken = token.access_token?.trim();
  if (!accessToken) {
    throw new Error(
      "Risposta token Google incompleta: access_token mancante. Ricollega Google Calendar."
    );
  }

  if (
    typeof token.expires_in !== "number" ||
    !Number.isFinite(token.expires_in) ||
    token.expires_in <= 0
  ) {
    throw new Error(
      "Risposta token Google incompleta: expires_in non valido. Ricollega Google Calendar."
    );
  }

  return {
    access_token: accessToken,
    expires_in: token.expires_in,
    refresh_token: token.refresh_token?.trim() || undefined,
    id_token: token.id_token?.trim() || undefined,
    scope: token.scope,
    token_type: token.token_type?.trim() || "Bearer",
  };
}

export function buildGoogleCalendarAuthUrl(
  state: string,
  options?: { forceConsent?: boolean; requestUrl?: string | null }
): string {
  assertGoogleCalendarEnvConfigured(options?.requestUrl);

  const clientId = getGoogleClientId();
  const redirectUri = resolveGoogleOAuthRedirectUri(options?.requestUrl);

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri!,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPE,
    access_type: "offline",
    include_granted_scopes: "false",
    prompt: options?.forceConsent === false ? "select_account" : "consent",
    state,
  });

  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export function getGoogleOAuthScopes(): readonly string[] {
  return GOOGLE_OAUTH_SCOPES;
}

export async function exchangeGoogleAuthCode(
  code: string,
  requestUrl?: string | null
): Promise<ValidatedGoogleTokenResponse> {
  assertGoogleCalendarEnvConfigured(requestUrl);

  const normalizedCode = code.trim();
  if (!normalizedCode) {
    throw new Error("Codice di autorizzazione Google mancante.");
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const redirectUri = resolveGoogleOAuthRedirectUri(requestUrl);

  const body = new URLSearchParams({
    code: normalizedCode,
    client_id: clientId!,
    client_secret: clientSecret!,
    redirect_uri: redirectUri!,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as GoogleTokenResponse | null;

  if (!response.ok || !payload) {
    throw new Error(formatGoogleOAuthError("Scambio token Google non riuscito", payload));
  }

  if (payload.error) {
    throw new Error(formatGoogleOAuthError("Scambio token Google non riuscito", payload));
  }

  const validated = validateGoogleTokenResponse(payload);

  if (!hasRequiredCalendarScope(validated.scope)) {
    throw new Error(
      "Permessi Google Calendar insufficienti: manca lo scope calendar.events. Ricollega e concedi l'accesso al calendario."
    );
  }

  return validated;
}

export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<ValidatedGoogleTokenResponse> {
  assertGoogleCalendarEnvConfigured();

  const normalizedRefreshToken = refreshToken.trim();
  if (!normalizedRefreshToken) {
    throw new Error("Refresh token Google mancante. Ricollega Google Calendar.");
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  const body = new URLSearchParams({
    refresh_token: normalizedRefreshToken,
    client_id: clientId!,
    client_secret: clientSecret!,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as GoogleTokenResponse | null;

  if (!response.ok || !payload) {
    throw new Error(formatGoogleOAuthError("Refresh token Google non riuscito", payload));
  }

  if (payload.error) {
    throw new Error(formatGoogleOAuthError("Refresh token Google non riuscito", payload));
  }

  return validateGoogleTokenResponse(payload);
}

export async function fetchGoogleUserEmail(
  accessToken: string,
  idToken?: string
): Promise<string> {
  const normalizedToken = accessToken?.trim();
  if (!normalizedToken) {
    throw new Error(
      "Access token Google mancante dopo l'autorizzazione. Ricollega Google Calendar."
    );
  }

  const response = await fetch(GOOGLE_USERINFO_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${normalizedToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as GoogleOpenIdUserInfo | null;

  if (response.ok) {
    const email = payload?.email?.trim();
    if (email) {
      return email;
    }
  }

  const idTokenEmail = idToken ? parseEmailFromIdToken(idToken) : null;
  if (idTokenEmail) {
    return idTokenEmail;
  }

  const googleMessage = payload?.error_description ?? payload?.error;
  throw new Error(
    googleMessage
      ? `Lettura profilo Google non riuscita: ${googleMessage}`
      : "Lettura profilo Google non riuscita. Ricollega Google Calendar e concedi i permessi email."
  );
}

export function tokenExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

/** Log sicuro: nessun token/secret. */
export function logGoogleCalendarSafe(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, string | number | boolean | null | undefined>
): void {
  const safe = meta
    ? Object.fromEntries(
        Object.entries(meta).filter(
          ([key]) => !/token|secret|password|authorization|code/i.test(key)
        )
      )
    : undefined;
  const line = safe ? `[google-calendar] ${message} ${JSON.stringify(safe)}` : `[google-calendar] ${message}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}
