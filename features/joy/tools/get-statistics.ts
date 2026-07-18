import "server-only";

import { getJoyData } from "@/features/joy/services/joy-ai.service";
import { getVisitDashboardMetrics } from "@/features/visits/services/visits.service";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyStatisticsSnapshot {
  userName: string;
  visitsToday: number;
  visitsThisWeek: number;
  agendaItemsToday: number;
  overdueFollowUps: number;
  openOpportunities: number;
  pipelineValue: string;
  inactiveClients: number;
  radarHits: number;
  estimatedTourKm: number;
}

export async function getStatistics(): Promise<JoyToolResult<JoyStatisticsSnapshot | null>> {
  try {
    const [joyData, visitMetrics] = await Promise.all([
      getJoyData(),
      getVisitDashboardMetrics(),
    ]);

    if (joyData.error && joyData.summary.visitsToday === 0 && joyData.summary.agendaItems === 0) {
      return emptyToolResult(null, joyData.error);
    }

    return successToolResult({
      userName: joyData.userName,
      visitsToday: joyData.summary.visitsToday,
      visitsThisWeek: visitMetrics.data?.visitsThisWeek ?? joyData.summary.visitsToday,
      agendaItemsToday: joyData.summary.agendaItems,
      overdueFollowUps: joyData.summary.overdueFollowUps,
      openOpportunities: joyData.summary.openOpportunities,
      pipelineValue: formatOpportunityAmount(joyData.summary.pipelineValue),
      inactiveClients: joyData.summary.inactiveClients,
      radarHits: joyData.summary.radarHits,
      estimatedTourKm: joyData.summary.estimatedTourKm,
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare le statistiche."
    );
  }
}
