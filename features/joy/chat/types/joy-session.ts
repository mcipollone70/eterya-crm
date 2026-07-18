/** Stati della sessione Conversazione (human ↔ Joy). */
export type JoySessionState =
  | "listening"
  | "thinking"
  | "proposing"
  | "confirming"
  | "completed"
  | "idle";

export const JOY_SESSION_STATE_LABELS: Record<JoySessionState, string> = {
  listening: "In ascolto",
  thinking: "Sto pensando",
  proposing: "Ti propongo un'azione",
  confirming: "Conferma richiesta",
  completed: "Operazione completata",
  idle: "Sessione in pausa",
};

export type JoyTourDay = "today" | "tomorrow";

export type JoyTourAudience = "prospect" | "clienti" | "entrambi";

export type JoyTourStartMode = "gps" | "sede" | "last_position" | "city";

export type JoyTourIntakeField =
  | "day"
  | "zone"
  | "audience"
  | "maxStops"
  | "maxArrivalTime"
  | "startMode";

/** Zona di ricerca: CAP/città/provincia oppure raggio intorno al GPS/coordinate. */
export type JoyTourZoneMode = "cap" | "city" | "province" | "gps";

/** Bozza multi-turn del giro — solo proposta, mai auto-salvata. */
export interface JoyTourPlanDraft {
  phase: "intake" | "proposed" | "active";
  day?: JoyTourDay | null;
  city?: string | null;
  cap?: string | null;
  /** Sigla o nome provincia (es. LT, Latina). */
  province?: string | null;
  /** Se "gps", cerca aziende nel raggio dalla posizione (senza CAP/città obbligatori). */
  zoneMode?: JoyTourZoneMode | null;
  /** Raggio km per zona GPS / coordinate (default 30). */
  radiusKm?: number | null;
  audience?: JoyTourAudience | null;
  maxStops?: number | null;
  maxArrivalTime?: string | null;
  startMode?: JoyTourStartMode | null;
  startCity?: string | null;
  endCity?: string | null;
  /** ID aziende nella proposta corrente. */
  stopCompanyIds?: string[];
  /** Aziende da forzare nelle tappe (es. «aggiungi cliente X»). */
  forceIncludeCompanyIds?: string[];
  skippedCompanyIds?: string[];
  /** Indice tappa corrente per «prossima tappa» (0-based). */
  currentStopIndex?: number;
  /** Domanda in attesa di risposta. */
  awaitingField?: JoyTourIntakeField | null;
  /** Ultima posizione nota (GPS o tappa). */
  lastLat?: number | null;
  lastLng?: number | null;
}

/** Obiettivo dichiarato della conversazione (piano giornata, giro, debrief…). */
export type JoyConversationGoal =
  | "morning_plan"
  | "tour"
  | "debrief"
  | "briefing"
  | "coach"
  | "end_of_day"
  | "search"
  | "sales_goal"
  | "free_time"
  | "general"
  | null;

/** Memoria conversazionale — evita di ripetere nomi/contesti. */
export interface JoyConversationMemory {
  lastCompanyId?: string | null;
  lastCompanyName?: string | null;
  lastContactName?: string | null;
  lastContactId?: string | null;
  lastVisitId?: string | null;
  lastOpportunityId?: string | null;
  lastOpportunityTitle?: string | null;
  lastQuoteId?: string | null;
  lastQuoteTitle?: string | null;
  lastOrderId?: string | null;
  lastOrderTitle?: string | null;
  lastFollowUpId?: string | null;
  lastFollowUpLabel?: string | null;
  lastRouteId?: string | null;
  lastRouteLabel?: string | null;
  lastComune?: string | null;
  lastDestinazione?: string | null;
  lastCap?: string | null;
  lastProvince?: string | null;
  /** Data contesto (es. oggi/domani del piano o del giro). */
  lastContextDate?: string | null;
  /** Ultima azione proposta in conferma (titolo). */
  lastProposedAction?: string | null;
  /** Risposta completa non troncata (per «dettaglio» in Drive/Guida). */
  lastFullAssistantContent?: string | null;
  conversationGoal?: JoyConversationGoal;
  selectedClientId?: string | null;
  selectedClientName?: string | null;
  /** Bozza / contesto giro Joy Drive. */
  tourDraft?: JoyTourPlanDraft | null;
  lastLat?: number | null;
  lastLng?: number | null;
  /** Obiettivo fatturato dichiarato a voce (es. «Voglio fatturare 50k»). */
  salesGoalAmount?: number | null;
  /** Periodo obiettivo: week | month | year. */
  salesGoalPeriod?: "week" | "month" | "year" | null;
  /** Preferenze suggerimenti proattivi (chiavi dismiss/snooze). */
  suggestionPrefs?: Record<string, string> | null;
  updatedAt?: string | null;
}

export const EMPTY_JOY_MEMORY: JoyConversationMemory = {};
