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

/** Esegue operazione principale + eventuali follow-up in sequenza (debrief multi-step). */
export async function executeJoyCopilotActionBatch(
  operation: JoyCopilotOperation,
  followUpOperations: JoyCopilotOperation[] = []
): Promise<JoyCopilotExecuteResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const primary = await executeJoyCopilotOperation(operation);
  if (!primary.success) {
    return primary;
  }

  const messages = [primary.message];
  let lastHref = primary.href;

  for (const followOp of followUpOperations) {
    const result = await executeJoyCopilotOperation(followOp);
    if (!result.success) {
      return {
        success: false,
        message: `${messages.join(" ")} Poi: ${result.message}`,
        href: lastHref,
      };
    }
    messages.push(result.message);
    if (result.href) {
      lastHref = result.href;
    }
  }

  return {
    success: true,
    message: messages.join(" "),
    href: lastHref,
  };
}
