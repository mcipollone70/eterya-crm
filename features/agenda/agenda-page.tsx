import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseAgendaFilters } from "@/lib/constants/agenda";
import { AgendaCreatePanel } from "./components/agenda-create-panel";
import { AgendaDayView, AgendaMonthView, AgendaWeekView } from "./components/agenda-calendar-views";
import { AgendaFiltersBar } from "./components/agenda-filters-bar";
import { AgendaViewTabs } from "./components/agenda-view-tabs";
import {
  listAgendaAgents,
  listAgendaCompanyOptions,
  listAgendaItems,
} from "./services/agenda.service";

interface AgendaPageProps {
  view?: string;
  date?: string;
  agent?: string;
  kind?: string;
  status?: string;
}

export async function AgendaPage({
  view,
  date,
  agent,
  kind,
  status,
}: AgendaPageProps) {
  const filters = parseAgendaFilters({ view, date, agent, kind, status });

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Agenda" subtitle="Calendario operativo unificato." />
        <EmptyState
          icon={CalendarDays}
          title="Database non configurato"
          message="Configura Supabase in .env.local per usare l'agenda."
        />
      </div>
    );
  }

  const [itemsResult, agentsResult, companiesResult] = await Promise.all([
    listAgendaItems(filters),
    listAgendaAgents(),
    listAgendaCompanyOptions(),
  ]);

  const agents = agentsResult.data ?? [];
  const companies = companiesResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        subtitle={`${itemsResult.data.length.toLocaleString("it-IT")} appuntamenti · visite, follow-up e promemoria`}
        actions={<AgendaCreatePanel companies={companies} />}
      />

      <Suspense fallback={null}>
        <AgendaViewTabs referenceDate={filters.date} rangeLabel={itemsResult.rangeLabel} />
      </Suspense>

      <Suspense fallback={null}>
        <AgendaFiltersBar agents={agents} />
      </Suspense>

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-violet-800">
          Visite
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-indigo-800">
          Follow-up
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-800">
          Promemoria interni
        </span>
      </div>

      {itemsResult.error ? (
        <EmptyState icon={CalendarDays} title="Impossibile caricare l'agenda" message={itemsResult.error} />
      ) : filters.view === "month" ? (
        <AgendaMonthView items={itemsResult.data} referenceDate={filters.date} />
      ) : filters.view === "week" ? (
        <AgendaWeekView items={itemsResult.data} referenceDate={filters.date} />
      ) : (
        <AgendaDayView items={itemsResult.data} referenceDate={filters.date} />
      )}
    </div>
  );
}
