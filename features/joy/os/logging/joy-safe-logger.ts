/**
 * Safe Joy OS logging — no PII dumps, no secrets, never throws.
 * Client + server safe (console only).
 */

export type JoyLogLevel = "debug" | "info" | "warn" | "error";

export type JoyErrorCode =
  | "insufficient_data"
  | "crm_read_failed"
  | "intent_unknown"
  | "confirm_required"
  | "offline"
  | "voice_unavailable"
  | "storage_quota"
  | "unexpected";

export interface JoyOsError {
  code: JoyErrorCode;
  message: string;
  recoverable: boolean;
  /** Safe context — never passwords, tokens, or full CRM dumps */
  context?: Record<string, string | number | boolean | null>;
  at: string;
}

const MAX_CONTEXT_KEYS = 8;

function sanitizeContext(
  context?: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> | undefined {
  if (!context) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  let n = 0;
  for (const [key, value] of Object.entries(context)) {
    if (n >= MAX_CONTEXT_KEYS) break;
    if (/password|token|secret|authorization|cookie/i.test(key)) continue;
    out[key] = value;
    n += 1;
  }
  return out;
}

export function createJoyOsError(
  code: JoyErrorCode,
  message: string,
  options?: {
    recoverable?: boolean;
    context?: Record<string, string | number | boolean | null>;
  }
): JoyOsError {
  return {
    code,
    message: message.slice(0, 280),
    recoverable: options?.recoverable ?? true,
    context: sanitizeContext(options?.context),
    at: new Date().toISOString(),
  };
}

export function formatJoyOsError(error: JoyOsError): string {
  switch (error.code) {
    case "insufficient_data":
      return error.message || "Dati CRM insufficienti per questa stima.";
    case "offline":
      return "Sei offline — Joy richiede connessione per leggere il CRM.";
    case "confirm_required":
      return "Azione in attesa di conferma — di' «conferma» o «annulla».";
    case "voice_unavailable":
      return "Microfono non disponibile — usa la tastiera.";
    case "storage_quota":
      return "Memoria locale piena — cancella la memoria operativa del giorno.";
    default:
      return error.message || "Qualcosa non ha funzionato. Riprova.";
  }
}

export function joySafeLog(
  level: JoyLogLevel,
  scope: string,
  message: string,
  context?: Record<string, string | number | boolean | null>
): void {
  try {
    const payload = {
      scope: `joy-os:${scope}`,
      message: message.slice(0, 200),
      context: sanitizeContext(context),
    };
    if (level === "error") {
      console.error(payload);
    } else if (level === "warn") {
      console.warn(payload);
    } else if (level === "debug" && process.env.NODE_ENV === "development") {
      console.debug(payload);
    } else if (level === "info" && process.env.NODE_ENV === "development") {
      console.info(payload);
    }
  } catch {
    // never throw from logger
  }
}
