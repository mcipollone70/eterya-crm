import { Building2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCompanyConfig } from "./services/company-config.service";
import { CompanyConfigForm } from "./components/company-config-form";

export async function CompanyConfigPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Configurazione Azienda" subtitle="Profilo e preferenze dell'organizzazione." />
        <EmptyState
          icon={Building2}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire la configurazione azienda."
        />
      </div>
    );
  }

  const { data: config, error } = await getCompanyConfig();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurazione Azienda"
        subtitle="Dati aziendali e default operativi usati nel CRM."
      />

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </p>
      ) : null}

      <CompanyConfigForm config={config} />
    </div>
  );
}
