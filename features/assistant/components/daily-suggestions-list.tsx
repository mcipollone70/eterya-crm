import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";
import { SuggestionCard } from "./suggestion-card";

interface DailySuggestionsListProps {
  suggestions: DailyVisitSuggestion[];
}

export function DailySuggestionsList({ suggestions }: DailySuggestionsListProps) {
  if (suggestions.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Nessun suggerimento per oggi con i filtri attuali. Prova a cambiare agente o verifica che le
        aziende siano geocodificate.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {suggestions.map((suggestion, index) => (
        <SuggestionCard key={suggestion.companyId} suggestion={suggestion} rank={index + 1} />
      ))}
    </div>
  );
}
