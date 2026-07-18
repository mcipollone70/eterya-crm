import { Suspense } from "react";
import Link from "next/link";
import { Plus, Boxes } from "lucide-react";
import { EmptyState, PageHeader, PageLoadingSkeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseSampleFilters } from "@/lib/constants/samples";
import { JoyAiPageLink } from "@/features/joy/components/joy-ai-page-link";
import { SampleFiltersBar } from "./components/sample-filters-bar";
import { SamplesList } from "./components/samples-list";
import { listSampleFilterOptions, listSamples } from "./services/samples.service";

interface SamplesPageProps {
  company?: string;
  product?: string;
  agent?: string;
  status?: string;
  from?: string;
  to?: string;
}

export async function SamplesPage(props: SamplesPageProps) {
  const filters = parseSampleFilters(props);

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Gestione Campioni" subtitle="Campioni prodotto consegnati alle aziende." />
        <EmptyState
          icon={Boxes}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire i campioni."
        />
      </div>
    );
  }

  const [samplesResult, filterOptionsResult] = await Promise.all([
    listSamples({ filters }),
    listSampleFilterOptions(),
  ]);

  const { data: samples, count, error } = samplesResult;
  const filterOptions = filterOptionsResult.data ?? { agents: [], companies: [] };
  const outstanding = samples.filter((item) => item.status === "consegnato").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestione Campioni"
        subtitle={`${count.toLocaleString("it-IT")} campioni · ${outstanding.toLocaleString("it-IT")} in prestito`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <JoyAiPageLink prompt="Campioni da recuperare" />
            <Link
              href="/campioni/new"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Nuovo campione
            </Link>
          </div>
        }
      />

      <Suspense fallback={<PageLoadingSkeleton rows={1} />}>
        <SampleFiltersBar agents={filterOptions.agents} companies={filterOptions.companies} />
      </Suspense>

      {error ? (
        <EmptyState icon={Boxes} title="Impossibile caricare i campioni" message={error} />
      ) : samples.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Nessun campione"
          message="Registra il primo campione consegnato a un'azienda oppure reimposta i filtri attivi."
        />
      ) : (
        <SamplesList items={samples} />
      )}
    </div>
  );
}
