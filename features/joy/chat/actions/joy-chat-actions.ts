"use server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { processJoyChatMessage } from "../services/joy-chat-engine.service";
import type { JoyChatResponse } from "../types/joy-chat";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function sendJoyChatMessageAction(message: string): Promise<JoyChatResponse> {
  if (!isSupabaseConfigured()) {
    return {
      message: {
        id: `joy-err-${Date.now()}`,
        role: "assistant",
        content: NOT_CONFIGURED_MESSAGE,
        createdAt: new Date().toISOString(),
      },
      error: NOT_CONFIGURED_MESSAGE,
    };
  }

  return processJoyChatMessage(message);
}
