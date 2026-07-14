"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { executeJoyCopilotOperation } from "../../chat/services/joy-copilot-executor.service";
import type { JoyCopilotExecuteResult, JoyCopilotOperation } from "../../chat/types/joy-chat";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function executeJoyAutonomousAction(
  operation: JoyCopilotOperation
): Promise<JoyCopilotExecuteResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const result = await executeJoyCopilotOperation(operation);
  if (result.success) {
    revalidatePath("/joy/autonomous");
    revalidatePath("/joy");
  }

  return result;
}
