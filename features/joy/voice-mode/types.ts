/**
 * Typed NL → JSON contract for Joy Mobile Guide Mode (Release 2).
 */

export type JoyGuideState =
  | "idle"
  | "listening"
  | "transcribing"
  | "interpreting"
  | "confirming"
  | "executing"
  | "speaking"
  | "paused"
  | "error";

export type JoyVoiceIntentType =
  | "read_agenda_today"
  | "open_tour_today"
  | "next_stop"
  | "navigate_next"
  | "navigate_company"
  | "search_company"
  | "open_company"
  | "register_visit"
  | "complete_visit"
  | "create_follow_up"
  | "create_reminder"
  | "list_brands"
  | "add_brand"
  | "set_brand_status"
  | "call_contact"
  | "open_whatsapp"
  | "prepare_email"
  | "confirm"
  | "cancel"
  | "clarify"
  | "unknown";

export interface JoyVoiceEntities {
  companyQuery?: string | null;
  companyId?: string | null;
  brandName?: string | null;
  brandId?: string | null;
  relationshipStatus?: string | null;
  outcome?: string | null;
  notes?: string | null;
  products?: string[];
  followUpDate?: string | null;
  reminderDate?: string | null;
  reminderText?: string | null;
  priority?: "low" | "medium" | "high" | null;
  phone?: string | null;
  email?: string | null;
  whatsappText?: string | null;
  quoteRequested?: boolean | null;
  indicativeValue?: number | null;
}

export interface JoyVoiceIntentResult {
  intent: JoyVoiceIntentType;
  confidence: number;
  companyId: string | null;
  requiresConfirmation: boolean;
  entities: JoyVoiceEntities;
  spokenReply: string;
  /** Human-readable interpretation for the drive UI */
  interpretation: string;
  /** Proposed action label for the drive UI */
  proposedAction: string | null;
  /** Clarification question when confidence low / ambiguous */
  clarifyQuestion?: string | null;
}

export interface JoyGuideScreenContext {
  companyId?: string | null;
  companyName?: string | null;
  tourId?: string | null;
  nextStopCompanyId?: string | null;
  nextStopName?: string | null;
  nextStopCity?: string | null;
  nextStopLat?: number | null;
  nextStopLng?: number | null;
  nextStopEtaMinutes?: number | null;
  visitStatus?: string | null;
  pathname?: string | null;
}

export interface JoyVoiceActionUi {
  kind: "navigate" | "tel" | "whatsapp" | "mailto" | "open_href" | "none";
  href: string | null;
  label: string | null;
}

export interface JoyVoiceExecuteResult {
  success: boolean;
  message: string;
  spokenReply: string;
  data?: Record<string, unknown> | null;
  ui?: JoyVoiceActionUi;
  needsConfirmation?: boolean;
  pendingIntent?: JoyVoiceIntentResult | null;
}

export const JOY_GUIDE_CONFIDENCE_MIN = 0.55;

export const JOY_GUIDE_STATE_LABELS: Record<JoyGuideState, string> = {
  idle: "Inattivo",
  listening: "In ascolto",
  transcribing: "Trascrizione",
  interpreting: "Sto elaborando",
  confirming: "In attesa di conferma",
  executing: "Esecuzione",
  speaking: "Sto parlando",
  paused: "In pausa",
  error: "Errore",
};
