import { notFound } from "next/navigation";
import { Target } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { getContactById } from "@/features/contacts/services/contacts.service";
import { getCompanyById } from "@/features/companies/services/companies.service";
import { OpportunityDetail } from "@/features/opportunities/components/opportunity-detail";
import { getOpportunityById } from "@/features/opportunities/services/opportunities.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dettaglio opportunità" };

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dettaglio opportunità" />
        <EmptyState
          icon={Target}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server."
        />
      </div>
    );
  }

  const opportunity = await getOpportunityById(id);
  if (!opportunity) {
    notFound();
  }

  const [{ data: company }, contactResult] = await Promise.all([
    getCompanyById(opportunity.company_id),
    opportunity.contact_id
      ? getContactById(opportunity.contact_id)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (!company) {
    notFound();
  }

  return (
    <OpportunityDetail
      opportunity={opportunity}
      company={company}
      contact={contactResult.data}
    />
  );
}
