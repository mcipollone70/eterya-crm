import { Suspense } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { EmptyState, PageHeader, PageLoadingSkeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AssistantFiltersBar } from "./components/assistant-filters-bar";
import { CompanyVisitBriefingPanel } from "./components/company-visit-briefing-panel";
import { DailySuggestionsList } from "./components/daily-suggestions-list";
import { getCompanyVisitBriefing } from "./services/company-briefing.service";
import {
  getDailyVisitSuggestions,
  listAssistantAgents,
} from "./services/assistant-suggestions.service";

interface AssistantPageProps {
  agent?: string;
  briefing?: string;
}

export async function AssistantPage({ agent, briefing }: AssistantPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="Assistente commerciale" subtitle="Suggerimenti visita giornalieri." />
        <EmptyState
          icon={Sparkles}
          title="Database non configurato"
          message="Configura Supabase in .env.local per usare l'assistente."
        />
      </div>
    );
  }

  const agentId = agent?.trim() || null;

  const [suggestionsResult, agentsResult, briefingResult] = await Promise.all([
    getDailyVisitSuggestions({ agentId, limit: 15 }),
    listAssistantAgents(),
    briefing ? getCompanyVisitBriefing(briefing) : Promise.resolve({ data: null, error: null }),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={briefing && briefingResult.data ? "Briefing AI" : "Assistente commerciale"}
        subtitle={
          briefing && briefingResult.data
            ? `Scheda pre-visita · ${briefingResult.data.companyName}`
            : "Oggi ti consiglio di visitare…"
        }
      />

      {!briefing && (
        <Suspense fallback={<PageLoadingSkeleton rows={1} />}>
          <AssistantFiltersBar agents={agentsResult.data ?? []} />
        </Suspense>
      )}

      {briefing && briefingResult.data && (
        <CompanyVisitBriefingPanel briefing={briefingResult.data} />
      )}

      {briefing && briefingResult.error && (
        <EmptyState
          icon={Sparkles}
          title="Briefing non disponibile"
          message={briefingResult.error}
          action={
            <Link href="/assistant" className="text-sm font-medium text-indigo-600 hover:underline">
              Torna ai suggerimenti
            </Link>
          }
        />
      )}

      {!briefing && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-slate-900 sm:text-lg">
            Oggi ti consiglio di visitare ({suggestionsResult.data.length})
          </h2>
          {suggestionsResult.error ? (
            <EmptyState
              icon={Sparkles}
              title="Impossibile generare i suggerimenti"
              message={suggestionsResult.error}
            />
          ) : (
            <DailySuggestionsList suggestions={suggestionsResult.data} />
          )}
        </div>
      )}

      <p className="hidden text-xs text-slate-500 sm:block">
        Priorità calcolata su distanza, storico visite, opportunità aperte, follow-up scaduti, valore
        cliente, probabilità di chiusura e interessi prodotto.
      </p>
    </div>
  );
}
