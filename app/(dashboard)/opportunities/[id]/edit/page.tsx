import Link from "next/link";
import { notFound } from "next/navigation";
import { Target } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { listContactsByCompany } from "@/features/contacts/services/contacts.service";
import { EditOpportunityForm } from "@/features/opportunities/components/edit-opportunity-form";
import { getOpportunityById } from "@/features/opportunities/services/opportunities.service";
import { listProducts } from "@/features/products/services/products.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifica opportunità" };

export default async function EditOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Modifica opportunità" />
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

  const [contactsResult, productsResult] = await Promise.all([
    listContactsByCompany(opportunity.company_id),
    listProducts({ activeOnly: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modifica opportunità"
        subtitle={opportunity.title}
        actions={
          <Link
            href={`/opportunities/${opportunity.id}`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Torna alla scheda
          </Link>
        }
      />
      <EditOpportunityForm
        opportunity={opportunity}
        contacts={contactsResult.data}
        products={productsResult.data}
      />
    </div>
  );
}
