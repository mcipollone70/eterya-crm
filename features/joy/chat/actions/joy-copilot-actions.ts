"use server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { executeJoyCopilotOperation } from "../services/joy-copilot-executor.service";
import type { JoyCopilotExecuteResult, JoyCopilotOperation } from "../types/joy-chat";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function executeJoyCopilotAction(
  operation: JoyCopilotOperation
): Promise<JoyCopilotExecuteResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  if (!operation?.type) {
    return { success: false, message: "Azione non valida." };
  }

  return executeJoyCopilotOperation(operation);
}
