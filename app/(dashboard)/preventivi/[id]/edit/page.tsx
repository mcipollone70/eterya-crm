import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { listContactsByCompany } from "@/features/contacts/services/contacts.service";
import { listProducts } from "@/features/products/services/products.service";
import { EditQuoteForm } from "@/features/quotes/components/edit-quote-form";
import { getQuoteById } from "@/features/quotes/services/quotes.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifica preventivo" };

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Modifica preventivo" />
        <EmptyState icon={FileText} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const quote = await getQuoteById(id);
  if (!quote) {
    notFound();
  }

  const [contactsResult, productsResult] = await Promise.all([
    listContactsByCompany(quote.company_id),
    listProducts({ activeOnly: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Modifica preventivo" subtitle={quote.title} />
      <EditQuoteForm
        quote={quote}
        contacts={contactsResult.data ?? []}
        products={productsResult.data ?? []}
      />
    </div>
  );
}
