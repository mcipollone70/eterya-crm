import { Building2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { CompaniesMapClient } from "./components/companies-map-client";
import {
  getMapFilterOptions,
  listMapCompanies,
} from "./services/map-companies.service";

export async function MapsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mappa" subtitle="Visualizza le aziende geolocalizzate." />
        <EmptyState
          icon={Building2}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
        />
      </div>
    );
  }

  const { data: companies, stats, error } = await listMapCompanies();
  const { provinces } = getMapFilterOptions(companies);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mappa" subtitle="Visualizza le aziende geolocalizzate." />
        <EmptyState icon={Building2} title="Impossibile caricare la mappa" message={error} />
      </div>
    );
  }

  return <CompaniesMapClient companies={companies} provinces={provinces} stats={stats} />;
}
