import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { QuotePrintView } from "@/features/quotes/components/quote-print-view";
import { getQuoteById } from "@/features/quotes/services/quotes.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Stampa preventivo" };

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Stampa preventivo" />
        <EmptyState icon={FileText} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const quote = await getQuoteById(id);
  if (!quote) {
    notFound();
  }

  return <QuotePrintView quote={quote} />;
}
