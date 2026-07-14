import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";
import type { JoyDayPlanItem, JoySummary } from "@/features/joy/types/joy-data";
import type { CommandCenterMission } from "../types/command-center";

function estimateTimeLabel(visitCount: number, km: number): string {
  const driveMinutes = Math.round((km / 45) * 60);
  const visitMinutes = visitCount * 40;
  const total = driveMinutes + visitMinutes;
  if (total < 60) {
    return `${total} min`;
  }
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function buildCommandCenterMission(input: {
  summary: JoySummary;
  dayPlan: JoyDayPlanItem[];
  suggestions: DailyVisitSuggestion[];
}): CommandCenterMission {
  const top = input.suggestions[0];
  const recommendedVisits = Math.max(input.dayPlan.length, Math.min(input.suggestions.length, 5));
  const potentialRevenue = input.summary.pipelineValue;

  let objective = "Consolidare la relazione con i clienti prioritari e chiudere le opportunità aperte.";
  if (input.summary.overdueFollowUps > 0) {
    objective = `Recuperare ${input.summary.overdueFollowUps} follow-up scaduti e mantenere il ritmo sul campo.`;
  } else if (input.dayPlan.length > 0) {
    objective = `Completare ${input.dayPlan.length} visite pianificate e massimizzare il fatturato potenziale.`;
  } else if (top) {
    objective = `Iniziare da ${top.companyName}: ${top.reasons[0] ?? "cliente prioritario Joy"}.`;
  }

  const priorityLabel =
    top?.tier === "high" ? "Alta" : top?.tier === "medium" ? "Media" : "Standard";

  return {
    objective,
    potentialRevenue,
    recommendedVisits,
    estimatedKm: input.summary.estimatedTourKm,
    estimatedTimeLabel: estimateTimeLabel(recommendedVisits, input.summary.estimatedTourKm),
    priorityLabel,
  };
}

export function formatMissionRevenue(value: number): string {
  return formatOpportunityAmount(value);
}
