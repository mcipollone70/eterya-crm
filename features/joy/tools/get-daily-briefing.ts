import "server-only";

import { getDailyVisitSuggestions } from "@/features/assistant/services/assistant-suggestions.service";
import { getJoyData } from "@/features/joy/services/joy-ai.service";
import { getAgendaToday, type JoyAgendaItem } from "./get-agenda";
import { getOverdueFollowUps, type JoyFollowUpRecord } from "./get-follow-ups";
import { getVisits, type JoyVisitRecord } from "./get-visits";
import { getCommercialStatistics, type JoyCommercialStatisticsSnapshot } from "./get-commercial-statistics";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyDailySuggestion {
  companyId: string;
  companyName: string;
  city: string | null;
  reason: string;
}

export interface JoyDailyBriefing {
  userName: string;
  dateLabel: string;
  statistics: JoyCommercialStatisticsSnapshot | null;
  agenda: JoyAgendaItem[];
  overdueFollowUps: JoyFollowUpRecord[];
  visitsToday: JoyVisitRecord[];
  suggestions: JoyDailySuggestion[];
}

export interface GetDailyBriefingOptions {
  userId?: string | null;
  companyId?: string;
}

export async function getDailyBriefing(
  options: GetDailyBriefingOptions = {}
): Promise<JoyToolResult<JoyDailyBriefing | null>> {
  const { userId, companyId } = options;

  try {
    const [joyData, agendaResult, overdueResult, visitsResult, statsResult, suggestionsResult] =
      await Promise.all([
        getJoyData(),
        getAgendaToday(userId ?? null),
        getOverdueFollowUps({ companyId, limit: 8 }),
        getVisits({ userId, companyId, period: "today", limit: 12 }),
        getCommercialStatistics(),
        companyId
          ? Promise.resolve({ data: [], error: null })
          : getDailyVisitSuggestions({ limit: 5, agentId: userId ?? null }),
      ]);

    const visits = visitsResult.data?.rows ?? [];

    const suggestions: JoyDailySuggestion[] = (suggestionsResult.data ?? []).map((item) => ({
      companyId: item.companyId,
      companyName: item.companyName,
      city: item.city,
      reason: item.reasons[0] ?? `Priorità ${item.tier}`,
    }));

    const briefing: JoyDailyBriefing = {
      userName: joyData.userName,
      dateLabel: joyData.dateLabel,
      statistics: statsResult.data,
      agenda: agendaResult.data ?? [],
      overdueFollowUps: overdueResult.data?.rows ?? [],
      visitsToday: visits,
      suggestions,
    };

    const hasData =
      briefing.agenda.length > 0 ||
      briefing.overdueFollowUps.length > 0 ||
      briefing.visitsToday.length > 0 ||
      briefing.suggestions.length > 0 ||
      briefing.statistics != null;

    if (!hasData && joyData.error) {
      return emptyToolResult(null, joyData.error);
    }

    return successToolResult(briefing);
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile preparare il briefing giornaliero."
    );
  }
}
