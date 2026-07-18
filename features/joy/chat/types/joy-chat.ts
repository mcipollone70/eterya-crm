import type { JoyConversationMemory } from "./joy-session";

export type JoyChatActionKind =
  | "open_company"
  | "plan_visit"
  | "call"
  | "navigate"
  | "briefing"
  | "follow_up"
  | "open_page";

export interface JoyChatActionButton {
  id: string;
  kind: JoyChatActionKind;
  label: string;
  href: string;
  external?: boolean;
}

export interface JoyChatListItem {
  id: string;
  title: string;
  subtitle?: string;
}

export type JoyCopilotOperation =
  | {
      type: "create_visit";
      companyId: string;
      companyName: string;
      scheduledAt: string;
      notes?: string | null;
    }
  | {
      type: "update_visit";
      visitId: string;
      companyId: string;
      companyName: string;
      scheduledAt: string;
    }
  | {
      /** Completa visita pianificata o registra visita con esito (schema visits.outcome). */
      type: "complete_visit";
      companyId: string;
      companyName: string;
      visitId?: string | null;
      outcome: string;
      notes?: string | null;
      completedAt?: string | null;
    }
  | {
      type: "cancel_visit";
      visitId: string;
      companyId: string;
      companyName: string;
    }
  | {
      type: "create_follow_up";
      companyId: string;
      companyName: string;
      scheduledAt: string;
      description?: string | null;
    }
  | {
      type: "update_follow_up";
      followUpId: string;
      companyId: string;
      companyName: string;
      scheduledAt: string;
    }
  | {
      type: "create_reminder";
      title: string;
      scheduledAt: string;
      companyId?: string | null;
      notes?: string | null;
    }
  | {
      type: "create_opportunity";
      companyId: string;
      companyName: string;
      title: string;
      probability?: number | null;
    }
  | {
      type: "create_quote";
      companyId: string;
      companyName: string;
      title: string;
    }
  | {
      type: "create_order";
      companyId: string;
      companyName: string;
      title: string;
    }
  | {
      type: "create_sample";
      companyId: string;
      companyName: string;
      title: string;
    }
  | {
      type: "create_service_ticket";
      companyId: string;
      companyName: string;
      title: string;
    }
  | {
      type: "create_note";
      companyId: string;
      companyName: string;
      title: string;
      notes: string;
    }
  | {
      type: "navigate";
      href: string;
      label: string;
    };

export type JoyCopilotPendingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "executed"
  | "failed";

/** Campi selezionabili nel debrief (checkbox / voice edit). */
export type JoyDebriefFieldKey =
  | "note"
  | "visitOutcome"
  | "followUp"
  | "opportunity"
  | "reminder";

export interface JoyDebriefFieldToggle {
  key: JoyDebriefFieldKey;
  label: string;
  enabled: boolean;
}

export interface JoyCopilotPendingAction {
  id: string;
  title: string;
  description: string;
  operation: JoyCopilotOperation;
  /** Operazioni aggiuntive eseguite in sequenza dopo la conferma (es. debrief multi-step). */
  followUpOperations?: JoyCopilotOperation[];
  /** Debrief: checkbox per salvare solo i campi confermati. */
  debriefFields?: JoyDebriefFieldToggle[];
  status: JoyCopilotPendingStatus;
}

export interface JoyChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: JoyChatActionButton[];
  items?: JoyChatListItem[];
  pendingAction?: JoyCopilotPendingAction;
  createdAt: string;
}

export interface JoyChatResponse {
  message: JoyChatMessage;
  error?: string | null;
  /** Patch di memoria conversazionale da applicare lato client. */
  memoryPatch?: JoyConversationMemory;
  /** Stato sessione suggerito (proposing / confirming / completed). */
  sessionState?: "proposing" | "confirming" | "completed" | "thinking";
}

export interface JoyCopilotExecuteResult {
  success: boolean;
  message: string;
  href?: string;
}
