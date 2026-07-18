import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import {
  proactiveChipsFromInterventions,
  runJoyOsReasoning,
} from "@/features/joy/os/joy-os";

const BASE_SUGGESTIONS = [
  "Inizia la giornata",
  "Ti consiglio le priorità di oggi",
  "Coach commerciale",
  "Cosa mi consigli di fare adesso?",
  "Organizza giro visite per domani",
  "Joy registra: visita conclusa",
];

export async function getJoyAiSuggestions(): Promise<string[]> {
  try {
    const user = await getCurrentUser();
    const userId = user?.id ?? null;
    const reasoning = await runJoyOsReasoning({
      userId,
      hour: new Date().getHours(),
      trigger: "proactive_tick",
    });

    const chips = proactiveChipsFromInterventions(reasoning.interventions, 6);
    if (chips.length >= 4) {
      return chips;
    }

    const suggestions: string[] = [...chips];
    const hour = new Date().getHours();

    if (hour < 12) {
      suggestions.push("Inizia la giornata");
    } else if (hour >= 17) {
      suggestions.push("Riepiloga la mia giornata");
    }

    suggestions.push("Coach commerciale");
    suggestions.push("Come aumentare il fatturato");

    if (reasoning.recommendedPrompt) {
      suggestions.unshift(reasoning.recommendedPrompt);
    }

    for (const decision of reasoning.decisions.slice(0, 3)) {
      suggestions.push(decision.action);
    }

    const unique = [...new Set(suggestions.filter(Boolean))];
    return unique.slice(0, 6);
  } catch {
    return BASE_SUGGESTIONS.slice(0, 6);
  }
}
