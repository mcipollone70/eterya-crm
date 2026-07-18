import { FileText } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCompanyById, listCompanies } from "@/features/companies/services/companies.service";
import { listContacts, listContactsByCompany } from "@/features/contacts/services/contacts.service";
import { listProducts } from "@/features/products/services/products.service";
import { NewQuoteForm } from "@/features/quotes/components/new-quote-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuovo preventivo" };

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Nuovo preventivo" />
        <EmptyState icon={FileText} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const defaultCompanyId = params.company?.trim() || undefined;

  const [companiesResult, contactsResult, productsResult, selectedCompanyResult] = await Promise.all([
    listCompanies(null, { pageSize: 100 }),
    defaultCompanyId
      ? listContactsByCompany(defaultCompanyId)
      : listContacts({ pageSize: 100 }),
    listProducts({ activeOnly: true }),
    defaultCompanyId ? getCompanyById(defaultCompanyId) : Promise.resolve({ data: null, error: null }),
  ]);

  const selectedCompany = selectedCompanyResult.data;

  const companyMap = new Map<string, { id: string; name: string }>();
  for (const company of companiesResult.data ?? []) {
    companyMap.set(company.id, { id: company.id, name: company.name });
  }
  if (selectedCompany) {
    companyMap.set(selectedCompany.id, {
      id: selectedCompany.id,
      name: selectedCompany.name,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuovo preventivo"
        subtitle="Crea un preventivo con righe prodotto, validità e numerazione progressiva."
      />
      <NewQuoteForm
        companies={Array.from(companyMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name, "it")
        )}
        contacts={contactsResult.data ?? []}
        products={productsResult.data ?? []}
        defaultCompanyId={defaultCompanyId}
      />
    </div>
  );
}
