import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/types";
import type { JoyChatMessage } from "../types/joy-chat";
import { isMissingTableError } from "../../tools/types";

export interface JoyConversationRecord {
  id: string;
  title: string;
  messages: JoyChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export const JOY_CONVERSATIONS_MIGRATION_HINT =
  "Esegui supabase/migrations/20260715_joy_conversations.sql nel SQL Editor di Supabase per abilitare la persistenza conversazioni Joy AI.";

function mapRow(row: {
  id: string;
  title: string;
  messages: Json;
  created_at: string;
  updated_at: string;
}): JoyConversationRecord {
  const messages = Array.isArray(row.messages)
    ? (row.messages as unknown as JoyChatMessage[])
    : [];
  return {
    id: row.id,
    title: row.title,
    messages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listJoyConversations(): Promise<{
  data: JoyConversationRecord[];
  error: string | null;
  tableMissing: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { data: [], error: "Non autenticato", tableMissing: false };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("joy_conversations")
    .select("id,title,messages,created_at,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      return { data: [], error: JOY_CONVERSATIONS_MIGRATION_HINT, tableMissing: true };
    }
    return { data: [], error: describeDbError(error), tableMissing: false };
  }

  return {
    data: (data ?? []).map(mapRow),
    error: null,
    tableMissing: false,
  };
}

export async function createJoyConversation(title = "Nuova chat"): Promise<{
  data: JoyConversationRecord | null;
  error: string | null;
  tableMissing: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: "Non autenticato", tableMissing: false };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("joy_conversations")
    .insert({ user_id: user.id, title, messages: [] })
    .select("id,title,messages,created_at,updated_at")
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      return { data: null, error: JOY_CONVERSATIONS_MIGRATION_HINT, tableMissing: true };
    }
    return { data: null, error: describeDbError(error), tableMissing: false };
  }

  return { data: mapRow(data), error: null, tableMissing: false };
}

export async function updateJoyConversation(
  conversationId: string,
  patch: { title?: string; messages?: JoyChatMessage[] }
): Promise<{ error: string | null; tableMissing: boolean }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Non autenticato", tableMissing: false };
  }

  const payload: { title?: string; messages?: Json } = {};
  if (patch.title !== undefined) {
    payload.title = patch.title;
  }
  if (patch.messages !== undefined) {
    payload.messages = patch.messages as unknown as Json;
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("joy_conversations")
    .update(payload)
    .eq("id", conversationId)
    .eq("user_id", user.id);

  if (error) {
    if (isMissingTableError(error)) {
      return { error: JOY_CONVERSATIONS_MIGRATION_HINT, tableMissing: true };
    }
    return { error: describeDbError(error), tableMissing: false };
  }

  return { error: null, tableMissing: false };
}

export async function deleteJoyConversation(conversationId: string): Promise<{
  error: string | null;
  tableMissing: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Non autenticato", tableMissing: false };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("joy_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", user.id);

  if (error) {
    if (isMissingTableError(error)) {
      return { error: JOY_CONVERSATIONS_MIGRATION_HINT, tableMissing: true };
    }
    return { error: describeDbError(error), tableMissing: false };
  }

  return { error: null, tableMissing: false };
}
