import "server-only";

import { listContactHistory } from "@/features/activities/services/contact-history.service";
import { listFollowUps } from "@/features/activities/services/follow-ups.service";
import { getJoyData } from "@/features/joy/services/joy-ai.service";
import { formatVisitDate } from "@/lib/last-visit/format";
import { getAgendaToday, type JoyAgendaItem } from "./get-agenda";
import { getOpportunities } from "./get-opportunities";
import { getQuotes } from "./get-quotes";
import { getOrders } from "./get-orders";
import { getFollowUps, type JoyFollowUpRecord } from "./get-follow-ups";
import { getVisits, type JoyVisitRecord } from "./get-visits";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyEndOfDayActivity {
  id: string;
  companyName: string | null;
  type: string;
  occurredAt: string;
  occurredLabel: string;
}

export interface JoyEndOfDaySummary {
  userName: string;
  dateLabel: string;
  completedVisits: JoyVisitRecord[];
  completedFollowUps: JoyFollowUpRecord[];
  activities: JoyEndOfDayActivity[];
  agendaRemaining: JoyAgendaItem[];
}

export interface GetEndOfDaySummaryOptions {
  userId?: string | null;
  companyId?: string;
}

export async function getEndOfDaySummary(
  options: GetEndOfDaySummaryOptions = {}
): Promise<JoyToolResult<JoyEndOfDaySummary | null>> {
  const { userId, companyId } = options;

  try {
    const [joyData, visitsResult, followUpsResult, activitiesResult, agendaResult] =
      await Promise.all([
        getJoyData(),
        getVisits({ userId, companyId, period: "today", limit: 20 }),
        listFollowUps({
          companyId,
          period: "today",
          limit: 50,
        }),
        listContactHistory({
          companyId,
          period: "today",
          limit: 20,
        }),
        getAgendaToday(userId ?? null),
      ]);

    const completedVisits = (visitsResult.data?.rows ?? []).filter(
      (visit) => visit.status === "completed"
    );

    const completedFollowUps = (followUpsResult.data ?? [])
      .filter((item) => item.status === "completed")
      .map((item) => ({
        id: item.id,
        companyId: item.company_id,
        companyName: item.company_name,
        contactName: item.contact_name,
        description: item.description,
        priority: item.priority,
        status: item.status,
        scheduledAt: item.scheduled_at,
        effectiveAt: item.effective_at,
      }));

    const activities: JoyEndOfDayActivity[] = (activitiesResult.data ?? []).map((item) => ({
      id: item.id,
      companyName: item.company_name,
      type: item.type,
      occurredAt: item.occurred_at,
      occurredLabel: formatVisitDate(item.occurred_at),
    }));

    const now = Date.now();
    const agendaRemaining = (agendaResult.data ?? []).filter(
      (item) => new Date(item.scheduledAt).getTime() >= now
    );

    const summary: JoyEndOfDaySummary = {
      userName: joyData.userName,
      dateLabel: joyData.dateLabel,
      completedVisits,
      completedFollowUps,
      activities,
      agendaRemaining,
    };

    const hasData =
      summary.completedVisits.length > 0 ||
      summary.completedFollowUps.length > 0 ||
      summary.activities.length > 0 ||
      summary.agendaRemaining.length > 0;

    if (!hasData && joyData.error) {
      return emptyToolResult(null, joyData.error);
    }

    return successToolResult(summary);
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile preparare il riepilogo di giornata."
    );
  }
}

export interface JoyWeeklyBriefing {
  userName: string;
  weekVisitsCount: number;
  weekVisits: JoyVisitRecord[];
  followUpsNext7: JoyFollowUpRecord[];
  overdueFollowUps: JoyFollowUpRecord[];
  openOpportunities: number;
  pipelineValue: string;
  quoteCount: number;
  orderCount: number;
}

export interface GetWeeklyBriefingOptions {
  userId?: string | null;
  companyId?: string;
}

export async function getWeeklyBriefing(
  options: GetWeeklyBriefingOptions = {}
): Promise<JoyToolResult<JoyWeeklyBriefing | null>> {
  const { userId, companyId } = options;

  try {
    const [joyData, visitsResult, followUpsWeek, overdueResult, opportunitiesData, quotesData, ordersData] =
      await Promise.all([
        getJoyData(),
        getVisits({ userId, companyId, period: "week", limit: 12 }),
        getFollowUps({ companyId, period: "next7", limit: 10 }),
        getFollowUps({ companyId, period: "overdue", limit: 8 }),
        getOpportunities({ companyId, limit: 1 }),
        getQuotes({ companyId, limit: 1 }),
        getOrders({ companyId, limit: 1 }),
      ]);

    const briefing: JoyWeeklyBriefing = {
      userName: joyData.userName,
      weekVisitsCount: visitsResult.data?.total ?? 0,
      weekVisits: visitsResult.data?.rows ?? [],
      followUpsNext7: followUpsWeek.data?.rows ?? [],
      overdueFollowUps: overdueResult.data?.rows ?? [],
      openOpportunities: opportunitiesData.data?.total ?? 0,
      pipelineValue: opportunitiesData.data?.openValue ?? "€ 0",
      quoteCount: quotesData.data?.quoteCount ?? 0,
      orderCount: ordersData.data?.orderCount ?? 0,
    };

    const hasData =
      briefing.weekVisitsCount > 0 ||
      briefing.followUpsNext7.length > 0 ||
      briefing.overdueFollowUps.length > 0 ||
      briefing.openOpportunities > 0 ||
      briefing.quoteCount > 0 ||
      briefing.orderCount > 0;

    if (!hasData && joyData.error) {
      return emptyToolResult(null, joyData.error);
    }

    return successToolResult(briefing);
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile preparare il briefing settimanale."
    );
  }
}
