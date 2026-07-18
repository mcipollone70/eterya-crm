import { Suspense } from "react";
import Link from "next/link";
import { Building2, Plus, Target } from "lucide-react";
import { EmptyState, PageHeader, PageLoadingSkeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parsePipelineFilters } from "@/lib/constants/pipeline-filters";
import { OpportunityKanban } from "./components/opportunity-kanban";
import { JoyAiPageLink } from "@/features/joy/components/joy-ai-page-link";
import { PipelineFiltersBar } from "./components/pipeline-filters-bar";
import { PipelineSummaryBar } from "./components/pipeline-summary-bar";
import { listOpportunities, listPipelineFilterOptions } from "./services/opportunities.service";

interface OpportunitiesPageProps {
  agent?: string;
  company?: string;
  priority?: string;
  from?: string;
  to?: string;
  minAmount?: number;
}

export async function OpportunitiesPage({
  agent,
  company,
  priority,
  from,
  to,
  minAmount,
}: OpportunitiesPageProps) {
  const filters = parsePipelineFilters({ agent, company, priority, from, to });

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pipeline Commerciale"
          subtitle="Gestione opportunità per fase commerciale."
        />
        <EmptyState
          icon={Target}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire la pipeline commerciale."
        />
      </div>
    );
  }

  const [opportunitiesResult, filterOptionsResult] = await Promise.all([
    listOpportunities({ filters }),
    listPipelineFilterOptions(),
  ]);

  if (minAmount != null && Number.isFinite(minAmount)) {
    opportunitiesResult.data = opportunitiesResult.data.filter(
      (item) => item.total_amount >= minAmount
    );
    opportunitiesResult.count = opportunitiesResult.data.length;
  }
  const { data: opportunities, count, error } = opportunitiesResult;
  const filterOptions = filterOptionsResult.data ?? { agents: [], companies: [] };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <JoyAiPageLink prompt="Mostrami la pipeline" />
      <Link
        href="/companies"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        <Building2 className="h-4 w-4" />
        Nuova da azienda
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline Commerciale"
        subtitle={`${count.toLocaleString("it-IT")} opportunità${
          count > opportunities.length
            ? ` · prime ${opportunities.length.toLocaleString("it-IT")} in Kanban`
            : ""
        } · vista Kanban con drag-and-drop.`}
        actions={headerActions}
      />

      <Suspense fallback={<PageLoadingSkeleton rows={1} />}>
        <PipelineFiltersBar
          agents={filterOptions.agents}
          companies={filterOptions.companies}
        />
      </Suspense>

      {!error && opportunities.length > 0 && (
        <PipelineSummaryBar
          items={opportunities}
          totalCount={count}
          filteredCount={opportunities.length}
        />
      )}

      {error ? (
        <EmptyState icon={Target} title="Impossibile caricare la pipeline" message={error} />
      ) : opportunities.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nessuna opportunità"
          message="Crea la prima opportunità dalla scheda azienda oppure reimposta i filtri attivi."
          action={
            <Link
              href="/companies"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Vai alle aziende
            </Link>
          }
        />
      ) : (
        <OpportunityKanban items={opportunities} />
      )}
    </div>
  );
}
