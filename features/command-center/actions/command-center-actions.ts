"use server";

import { revalidatePath } from "next/cache";
import { executeJoyCopilotOperation } from "@/features/joy/chat/services/joy-copilot-executor.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { JoyCopilotExecuteResult, JoyCopilotOperation } from "@/features/joy/chat/types/joy-chat";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

export async function executeCommandCenterAction(
  operation: JoyCopilotOperation
): Promise<JoyCopilotExecuteResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const result = await executeJoyCopilotOperation(operation);
  if (result.success) {
    revalidatePath("/command-center");
    revalidatePath("/joy");
    revalidatePath("/joy/chat");
    revalidatePath("/joy/autonomous");
    revalidatePath("/");
    revalidatePath("/agenda");
    revalidatePath("/visits");
  }

  return result;
}
