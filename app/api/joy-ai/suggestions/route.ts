import { getCurrentUser } from "@/features/auth/session";
import { getJoyAiSuggestions } from "@/features/joy/services/joy-ai-suggestions.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({ suggestions: [] });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  const suggestions = await getJoyAiSuggestions();
  return Response.json({ suggestions });
}
