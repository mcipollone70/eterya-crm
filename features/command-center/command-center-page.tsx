import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { CommandCenterScreen } from "./components/command-center-screen";
import { getCommandCenterData } from "./services/command-center.service";

export async function CommandCenterPage() {
  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="Database non configurato"
        message="Configura Supabase in .env.local per usare il Command Center."
      />
    );
  }

  const data = await getCommandCenterData();
  return <CommandCenterScreen data={data} />;
}
