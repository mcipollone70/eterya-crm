import { Car } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AutoModeScreen } from "./components/auto-mode-screen";
import { getAutoModeData } from "./services/auto-mode.service";

export async function AutoPage() {
  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Car}
        title="Database non configurato"
        message="Configura Supabase in .env.local per usare la modalità auto."
      />
    );
  }

  const data = await getAutoModeData();

  if (data.error && !data.appointment) {
    return (
      <EmptyState
        icon={Car}
        title="Impossibile caricare la modalità auto"
        message={data.error}
      />
    );
  }

  return (
    <AutoModeScreen
      appointment={data.appointment}
      calendar={data.calendar}
      companies={data.companies}
    />
  );
}
