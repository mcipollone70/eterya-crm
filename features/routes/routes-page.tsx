import { Route } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { VisitTourClient } from "./components/visit-tour-client";
import { getVisitTourCompanies } from "./services/visit-tour-data.service";

export async function RoutesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Giro Visite" subtitle="Pianifica il percorso di visita sul campo." />
        <EmptyState
          icon={Route}
          title="Database non configurato"
          message="Configura Supabase in .env.local per pianificare i giri visite."
        />
      </div>
    );
  }

  const { data: companies, error } = await getVisitTourCompanies();

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Giro Visite" subtitle="Pianifica il percorso di visita sul campo." />
        <EmptyState icon={Route} title="Impossibile caricare le aziende" message={error} />
      </div>
    );
  }

  return <VisitTourClient companies={companies} />;
}
