import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { CompanyDetail, getCompanyById } from "@/features/companies";
import { listContactsByCompany } from "@/features/contacts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dettaglio azienda" };

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    period?: string;
    visit?: string;
  }>;
}) {
  const { id } = await params;
  const { tab, period, visit } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dettaglio azienda" />
        <EmptyState
          icon={Building2}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server per consultare l'azienda."
        />
      </div>
    );
  }

  const { data: company, error } = await getCompanyById(id);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dettaglio azienda" />
        <EmptyState icon={Building2} title="Impossibile caricare l'azienda" message={error} />
      </div>
    );
  }

  if (!company) {
    notFound();
  }

  const { data: contacts } = await listContactsByCompany(id);

  return (
    <CompanyDetail
      company={company}
      contacts={contacts}
      activeTab={tab}
      historyPeriod={period}
      registerVisit={visit === "1"}
    />
  );
}
