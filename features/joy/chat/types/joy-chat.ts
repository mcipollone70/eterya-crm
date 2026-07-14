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
      type: "navigate";
      href: string;
      label: string;
    };

export type JoyCopilotPendingStatus = "pending" | "confirmed" | "cancelled" | "executed";

export interface JoyCopilotPendingAction {
  id: string;
  title: string;
  description: string;
  operation: JoyCopilotOperation;
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
}

export interface JoyCopilotExecuteResult {
  success: boolean;
  message: string;
  href?: string;
}
