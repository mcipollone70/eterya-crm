import { EntityForm, PageHeader } from "@/components/ui";
import { COMPANY_FORM_SECTIONS, createCompanyAction } from "@/features/companies";

export const metadata = { title: "Nuova azienda" };

export default function NewCompanyPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Nuova azienda" subtitle="Inserisci una nuova azienda manualmente." />
      <EntityForm
        sections={COMPANY_FORM_SECTIONS}
        action={createCompanyAction}
        submitLabel="Crea azienda"
        cancelHref="/companies"
        defaults={{ status: "prospect", country: "IT" }}
      />
    </div>
  );
}
