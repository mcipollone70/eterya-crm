import { Suspense } from "react";
import Link from "next/link";
import { Building2, FileText } from "lucide-react";
import { EmptyState, PageHeader, PageLoadingSkeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseQuoteFilters } from "@/lib/constants/quotes";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { QuoteFiltersBar } from "./components/quote-filters-bar";
import { JoyAiPageLink } from "@/features/joy/components/joy-ai-page-link";
import { QuotesList } from "./components/quotes-list";
import { listQuoteFilterOptions, listQuotes } from "./services/quotes.service";

interface QuotesPageProps {
  status?: string;
  company?: string;
  agent?: string;
}

export async function QuotesPage({ status, company, agent }: QuotesPageProps) {
  const filters = parseQuoteFilters({ status, company, agent });

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Preventivi" subtitle="Gestione preventivi commerciali." />
        <EmptyState
          icon={FileText}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire i preventivi."
        />
      </div>
    );
  }

  const [quotesResult, filterOptionsResult] = await Promise.all([
    listQuotes({ filters }),
    listQuoteFilterOptions(),
  ]);

  const { data: quotes, count, error } = quotesResult;
  const filterOptions = filterOptionsResult.data ?? { agents: [], companies: [] };
  const totalValue = quotes.reduce(
    (sum, item) => sum + (Number.isFinite(item.total_amount) ? item.total_amount : 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preventivi"
        subtitle={`${count.toLocaleString("it-IT")} preventivi · ${formatOpportunityAmount(totalValue)} totali`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <JoyAiPageLink prompt="Mostrami i preventivi" />
            <Link
              href="/preventivi/new"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
            >
              <FileText className="h-4 w-4" />
              Nuovo preventivo
            </Link>
            <Link
              href="/companies"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Building2 className="h-4 w-4" />
              Da azienda
            </Link>
          </div>
        }
      />

      <Suspense fallback={<PageLoadingSkeleton rows={1} />}>
        <QuoteFiltersBar
          agents={filterOptions.agents}
          companies={filterOptions.companies}
        />
      </Suspense>

      {error ? (
        <EmptyState icon={FileText} title="Impossibile caricare i preventivi" message={error} />
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nessun preventivo"
          message="Crea un preventivo dalla scheda azienda oppure reimposta i filtri attivi."
        />
      ) : (
        <QuotesList items={quotes} />
      )}
    </div>
  );
}
