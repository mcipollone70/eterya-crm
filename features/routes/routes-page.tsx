import { Route } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { VisitTourClient } from "./components/visit-tour-client";
import { listVisitTourAgents } from "./services/visit-tour-saved.service";

export async function RoutesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Giro Visite"
          subtitle="Organizza il percorso commerciale e individua le aziende vicine al tragitto."
        />
        <EmptyState
          icon={Route}
          title="Database non configurato"
          message="Configura Supabase in .env.local per pianificare i giri visite."
        />
      </div>
    );
  }

  const agentsResult = await listVisitTourAgents();

  return <VisitTourClient agents={agentsResult.data ?? []} />;
}
