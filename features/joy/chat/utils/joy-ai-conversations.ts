import type { JoyChatMessage } from "../types/joy-chat";

export const JOY_AI_CONVERSATIONS_KEY = "joy-ai-conversations";
export const JOY_AI_ACTIVE_CONVERSATION_KEY = "joy-ai-active-conversation";
const MAX_CONVERSATIONS = 40;
const MAX_MESSAGES_PER_CONVERSATION = 80;

export interface JoyAiConversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: JoyChatMessage[];
  /** `true` when synced with `joy_conversations` on Supabase. */
  remote?: boolean;
}

function newConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createConversation(title = "Nuova chat"): JoyAiConversation {
  return {
    id: newConversationId(),
    title,
    updatedAt: new Date().toISOString(),
    messages: [],
    remote: false,
  };
}

export function deriveConversationTitle(messages: JoyChatMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser?.content.trim()) {
    return "Nuova chat";
  }
  const trimmed = firstUser.content.trim();
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed;
}

export function sortConversationsByDate(conversations: JoyAiConversation[]): JoyAiConversation[] {
  return [...conversations].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function loadConversations(): JoyAiConversation[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(JOY_AI_CONVERSATIONS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as JoyAiConversation[];
    return Array.isArray(parsed)
      ? sortConversationsByDate(parsed.slice(0, MAX_CONVERSATIONS))
      : [];
  } catch {
    return [];
  }
}

export function persistConversations(conversations: JoyAiConversation[]) {
  if (typeof window === "undefined") {
    return;
  }

  const localOnly = conversations.filter((conversation) => !conversation.remote);
  window.localStorage.setItem(
    JOY_AI_CONVERSATIONS_KEY,
    JSON.stringify(sortConversationsByDate(localOnly).slice(0, MAX_CONVERSATIONS))
  );
}

export function loadActiveConversationId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(JOY_AI_ACTIVE_CONVERSATION_KEY);
}

export function persistActiveConversationId(id: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (id) {
    window.localStorage.setItem(JOY_AI_ACTIVE_CONVERSATION_KEY, id);
  } else {
    window.localStorage.removeItem(JOY_AI_ACTIVE_CONVERSATION_KEY);
  }
}

export function trimConversationMessages(messages: JoyChatMessage[]): JoyChatMessage[] {
  return messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
}

export interface RemoteJoyConversation {
  id: string;
  title: string;
  messages: JoyChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export function mapRemoteConversation(record: RemoteJoyConversation): JoyAiConversation {
  return {
    id: record.id,
    title: record.title,
    updatedAt: record.updatedAt,
    messages: record.messages,
    remote: true,
  };
}

export async function fetchRemoteConversations(): Promise<{
  conversations: JoyAiConversation[];
  tableMissing: boolean;
}> {
  const response = await fetch("/api/joy-ai/conversations");
  if (!response.ok) {
    return { conversations: [], tableMissing: true };
  }

  const payload = (await response.json()) as {
    conversations?: RemoteJoyConversation[];
    tableMissing?: boolean;
  };

  if (payload.tableMissing) {
    return { conversations: [], tableMissing: true };
  }

  const conversations = (payload.conversations ?? []).map(mapRemoteConversation);
  return { conversations: sortConversationsByDate(conversations), tableMissing: false };
}

export async function createRemoteConversation(title = "Nuova chat"): Promise<JoyAiConversation | null> {
  const response = await fetch("/api/joy-ai/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { conversation?: RemoteJoyConversation };
  if (!payload.conversation) {
    return null;
  }

  return mapRemoteConversation(payload.conversation);
}

export async function syncRemoteConversation(conversation: JoyAiConversation): Promise<boolean> {
  if (!conversation.remote) {
    return false;
  }

  const response = await fetch("/api/joy-ai/conversations", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
    }),
  });

  return response.ok;
}

export async function deleteRemoteConversation(conversationId: string): Promise<boolean> {
  const response = await fetch(`/api/joy-ai/conversations?id=${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
  });
  return response.ok;
}

export async function fetchJoyAiSuggestions(): Promise<string[]> {
  try {
    const response = await fetch("/api/joy-ai/suggestions");
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { suggestions?: string[] };
    return payload.suggestions ?? [];
  } catch {
    return [];
  }
}
