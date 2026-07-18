import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCompanyById, resolveCompanyDisplayFields } from "@/features/companies/services/companies.service";
import { QuoteDetail } from "@/features/quotes/components/quote-detail";
import { getQuoteById } from "@/features/quotes/services/quotes.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dettaglio preventivo" };

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dettaglio preventivo" />
        <EmptyState
          icon={FileText}
          title="Database non configurato"
          message="Configura Supabase in .env.local."
        />
      </div>
    );
  }

  const quote = await getQuoteById(id);
  if (!quote) {
    notFound();
  }

  const companyResult = await getCompanyById(quote.company_id);
  const companyEmail = companyResult.data
    ? resolveCompanyDisplayFields(companyResult.data).email
    : null;

  return <QuoteDetail quote={quote} companyEmail={companyEmail} />;
}
