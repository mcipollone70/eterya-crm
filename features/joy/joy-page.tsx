import { Sparkles } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { JoyAiScreen } from "./components/joy-ai-screen";
import { getJoyData } from "./services/joy-ai.service";

export async function JoyPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Joy AI" subtitle="Assistente commerciale intelligente." />
        <EmptyState
          icon={Sparkles}
          title="Database non configurato"
          message="Configura Supabase in .env.local per usare Joy AI."
        />
      </div>
    );
  }

  const data = await getJoyData();

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Joy AI"
        subtitle="Il tuo assistente commerciale per la giornata sul campo."
      />
      <JoyAiScreen data={data} />
    </div>
  );
}
