import type { JoyVoiceIntentType } from "./types";

/** Read-only / prepare-only — no confirmation. */
const NO_CONFIRM: ReadonlySet<JoyVoiceIntentType> = new Set([
  "read_agenda_today",
  "open_tour_today",
  "next_stop",
  "navigate_next",
  "navigate_company",
  "search_company",
  "open_company",
  "list_brands",
  "call_contact",
  "open_whatsapp",
  "prepare_email",
  "clarify",
  "unknown",
  "confirm",
  "cancel",
]);

/** Mutations — require explicit voice/manual confirm. */
const REQUIRES_CONFIRM: ReadonlySet<JoyVoiceIntentType> = new Set([
  "register_visit",
  "complete_visit",
  "create_follow_up",
  "create_reminder",
  "add_brand",
  "set_brand_status",
]);

export function intentRequiresConfirmation(intent: JoyVoiceIntentType): boolean {
  if (REQUIRES_CONFIRM.has(intent)) return true;
  if (NO_CONFIRM.has(intent)) return false;
  return true;
}

const CONFIRM_RE =
  /^(conferma|confermo|si|sì|ok|va bene|procedi|salva|certo|esatto)(?:\s+per favore)?[.!?]*$/i;

const CANCEL_RE =
  /^(annulla|no|cancella|lascia stare|non salvare|stop)(?:\s+per favore)?[.!?]*$/i;

export function isConfirmUtterance(text: string): boolean {
  return CONFIRM_RE.test(text.trim());
}

export function isCancelUtterance(text: string): boolean {
  return CANCEL_RE.test(text.trim());
}

/** R2: no definitive voice deletions. */
export function isForbiddenVoiceDeletion(text: string): boolean {
  const n = text.trim().toLowerCase();
  return (
    /\b(elimina|cancella\s+definitiv|rimuovi\s+l'?azienda|delete)\b/.test(n) &&
    !/\b(annulla|lascia stare)\b/.test(n)
  );
}
