import { Target } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { OpportunityKanban } from "./components/opportunity-kanban";
import { listOpportunities } from "./services/opportunities.service";

export async function OpportunitiesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Opportunità" subtitle="Pipeline commerciale per fase." />
        <EmptyState
          icon={Target}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire le opportunità."
        />
      </div>
    );
  }

  const { data: opportunities, count, error } = await listOpportunities();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunità"
        subtitle={`${count.toLocaleString("it-IT")} opportunità nella pipeline${
          count > opportunities.length
            ? ` · prime ${opportunities.length.toLocaleString("it-IT")} in Kanban`
            : ""
        } · vista Kanban.`}
      />

      {error ? (
        <EmptyState icon={Target} title="Impossibile caricare le opportunità" message={error} />
      ) : opportunities.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nessuna opportunità"
          message="Crea la prima opportunità dalla scheda azienda."
        />
      ) : (
        <OpportunityKanban items={opportunities} />
      )}
    </div>
  );
}
