import { Suspense } from "react";
import { CalendarRange } from "lucide-react";
import { EmptyState, PageHeader, PageLoadingSkeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { listAgendaAgents, listAgendaItems } from "@/features/agenda";
import {
  isAgendaKindFilter,
  parseAgendaFilters,
} from "@/lib/constants/agenda";
import { SharedCalendarFilters } from "./components/shared-calendar-filters";
import { SharedCalendarBoard } from "./components/shared-calendar-board";

interface SharedCalendarPageProps {
  agent?: string;
  kind?: string;
  date?: string;
}

export async function SharedCalendarPage({ agent, kind, date }: SharedCalendarPageProps) {
  const filters = parseAgendaFilters({
    view: "week",
    date,
    agent,
    kind: isAgendaKindFilter(kind) ? kind : undefined,
    status: "open",
  });

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Calendario condiviso" subtitle="Agenda di squadra per agente." />
        <EmptyState
          icon={CalendarRange}
          title="Database non configurato"
          message="Configura Supabase in .env.local per usare il calendario condiviso."
        />
      </div>
    );
  }

  const [itemsResult, agentsResult] = await Promise.all([
    listAgendaItems(filters),
    listAgendaAgents(),
  ]);

  const items = itemsResult.data ?? [];
  const agents = agentsResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario condiviso"
        subtitle={`Settimana ${itemsResult.rangeLabel} · ${items.length.toLocaleString("it-IT")} appuntamenti di squadra`}
      />

      <Suspense fallback={<PageLoadingSkeleton rows={1} />}>
        <SharedCalendarFilters agents={agents} />
      </Suspense>

      {itemsResult.error ? (
        <EmptyState
          icon={CalendarRange}
          title="Impossibile caricare il calendario"
          message={itemsResult.error}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nessun appuntamento questa settimana"
          message="Non ci sono visite, follow-up o promemoria pianificati nel periodo selezionato."
        />
      ) : (
        <SharedCalendarBoard items={items} />
      )}
    </div>
  );
}
