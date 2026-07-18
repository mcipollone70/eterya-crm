import { Suspense } from "react";
import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { EmptyState, PageHeader, PageLoadingSkeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseServiceTicketFilters } from "@/lib/constants/service-tickets";
import { JoyAiPageLink } from "@/features/joy/components/joy-ai-page-link";
import { ServiceTicketFiltersBar } from "./components/service-ticket-filters-bar";
import { ServiceTicketsList } from "./components/service-tickets-list";
import {
  listServiceTicketFilterOptions,
  listServiceTickets,
} from "./services/service-tickets.service";

interface ServicePageProps {
  company?: string;
  product?: string;
  agent?: string;
  status?: string;
  priority?: string;
}

export async function ServicePage(props: ServicePageProps) {
  const filters = parseServiceTicketFilters(props);

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Gestione Assistenza" subtitle="Ticket e interventi post-vendita." />
        <EmptyState
          icon={LifeBuoy}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire l'assistenza."
        />
      </div>
    );
  }

  const [ticketsResult, filterOptionsResult] = await Promise.all([
    listServiceTickets({ filters }),
    listServiceTicketFilterOptions(),
  ]);

  const { data: tickets, count, error } = ticketsResult;
  const filterOptions = filterOptionsResult.data ?? { agents: [], companies: [] };
  const open = tickets.filter(
    (item) => item.status !== "chiuso" && item.status !== "risolto"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestione Assistenza"
        subtitle={`${count.toLocaleString("it-IT")} ticket · ${open.toLocaleString("it-IT")} aperti`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <JoyAiPageLink prompt="Ticket assistenza aperti" />
            <Link
              href="/assistenza/new"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Nuovo ticket
            </Link>
          </div>
        }
      />

      <Suspense fallback={<PageLoadingSkeleton rows={1} />}>
        <ServiceTicketFiltersBar
          agents={filterOptions.agents}
          companies={filterOptions.companies}
        />
      </Suspense>

      {error ? (
        <EmptyState icon={LifeBuoy} title="Impossibile caricare i ticket" message={error} />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Nessun ticket di assistenza"
          message="Apri il primo ticket di assistenza oppure reimposta i filtri attivi."
        />
      ) : (
        <ServiceTicketsList items={tickets} />
      )}
    </div>
  );
}
