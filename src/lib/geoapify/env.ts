import "server-only";

import type { GeoapifyConfigView } from "./types";

const GEOAPIFY_API_KEY_ENV = "GEOAPIFY_API_KEY";

/** `true` se la chiave Geoapify è configurata lato server. Mai esporre al client. */
export function isGeoapifyConfigured(): boolean {
  const key = process.env[GEOAPIFY_API_KEY_ENV];
  return typeof key === "string" && key.trim().length > 0;
}

/** Restituisce la chiave Geoapify o `null` se assente. Solo uso server-side. */
export function getGeoapifyApiKey(): string | null {
  const key = process.env[GEOAPIFY_API_KEY_ENV];
  if (!key || !key.trim()) {
    return null;
  }
  return key.trim();
}

/** Stato configurazione Geoapify per la UI (senza esporre la chiave). */
export function getGeoapifyConfigView(): GeoapifyConfigView {
  const configured = isGeoapifyConfigured();

  return {
    configured,
    label: configured ? "Geoapify configurato" : "Chiave mancante",
  };
}

/**
 * Verifica lato server che GEOAPIFY_API_KEY sia leggibile da process.env.
 * Restituisce la lunghezza della chiave, mai il valore.
 */
export function verifyGeoapifyApiKeyReadable(): {
  configured: boolean;
  keyLength: number;
} {
  const key = getGeoapifyApiKey();

  return {
    configured: key !== null,
    keyLength: key?.length ?? 0,
  };
}

/**
 * Geocodifica attiva quando GEOAPIFY_API_KEY è configurata.
 */
export function isGeocodingExecutionEnabled(): boolean {
  return isGeoapifyConfigured();
}
