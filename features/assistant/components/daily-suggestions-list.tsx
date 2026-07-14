import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button, ListEmptyState } from "@/components/ui";
import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";
import { SuggestionCard } from "./suggestion-card";

interface DailySuggestionsListProps {
  suggestions: DailyVisitSuggestion[];
}

export function DailySuggestionsList({ suggestions }: DailySuggestionsListProps) {
  if (suggestions.length === 0) {
    return (
      <ListEmptyState
        icon={Sparkles}
        title="Nessun suggerimento per oggi"
        message="Prova a cambiare agente o verifica che le aziende siano geocodificate."
        action={
          <Link href="/maps">
            <Button size="lg" variant="outline">
              Apri mappa
            </Button>
          </Link>
        }
      />
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
