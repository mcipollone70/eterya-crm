import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { EmptyState, EntityForm, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { flattenFields, pickDefaults } from "@/lib/forms";
import {
  COMPANY_FORM_SECTIONS,
  getCompanyById,
  updateCompanyAction,
} from "@/features/companies";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifica azienda" };

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Modifica azienda" />
        <EmptyState
          icon={Building2}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server per modificare l'azienda."
        />
      </div>
    );
  }

  const { data: company, error } = await getCompanyById(id);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Modifica azienda" />
        <EmptyState icon={Building2} title="Impossibile caricare l'azienda" message={error} />
      </div>
    );
  }

  if (!company) {
    notFound();
  }

  const defaults = pickDefaults(company, flattenFields(COMPANY_FORM_SECTIONS));

  return (
    <div className="space-y-6">
      <PageHeader title="Modifica azienda" subtitle={company.name} />
      <EntityForm
        sections={COMPANY_FORM_SECTIONS}
        action={updateCompanyAction.bind(null, id)}
        submitLabel="Salva modifiche"
        cancelHref={`/companies/${id}`}
        defaults={defaults}
      />
    </div>
  );
}
