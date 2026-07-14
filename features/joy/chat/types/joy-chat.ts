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

export interface JoyChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: JoyChatActionButton[];
  items?: JoyChatListItem[];
  createdAt: string;
}

export interface JoyChatResponse {
  message: JoyChatMessage;
  error?: string | null;
}
