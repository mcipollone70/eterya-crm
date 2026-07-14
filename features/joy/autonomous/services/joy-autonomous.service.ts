import "server-only";

import { listFollowUps } from "@/features/activities/services/follow-ups.service";
import { getMissionControlData } from "@/features/dashboard/services/mission-control.service";
import { listOpportunities } from "@/features/opportunities/services/opportunities.service";
import { listVisits } from "@/features/visits/services/visits.service";
import {
  formatOpportunityAmount,
  isOpenOpportunityStage,
} from "@/lib/constants/opportunity-pipeline";
import { getJoyData } from "../../services/joy-ai.service";
import type {
  JoyAutonomousData,
  JoyAutonomousFocusItem,
  JoyAutonomousMorningBriefing,
} from "../types/joy-autonomous";
import { buildAutonomousDecisions } from "../utils/build-autonomous-decisions";
import { buildAutonomousNotifications } from "../utils/build-autonomous-notifications";

function buildMorningBriefing(
  joyData: Awaited<ReturnType<typeof getJoyData>>,
  missionData: Awaited<ReturnType<typeof getMissionControlData>>
): JoyAutonomousMorningBriefing {
  const urgentOpportunities = missionData.kpis.hotOpportunities;
  const openOpps = joyData.suggestions
    .filter((item) => item.signals.openOpportunityCount > 0)
    .slice(0, 5)
    .map((item) => ({
      id: `urgent-${item.companyId}`,
      title: `Opportunità aperta · ${item.companyName}`,
      companyName: item.companyName,
      amount: item.signals.openPipelineValue,
      probability: item.signals.maxOpportunityProbability,
      href: `/opportunities`,
    }));

  const followUpsDue = joyData.risks
    .filter((risk) => risk.id.startsWith("risk-followup-"))
    .slice(0, 6)
    .map((risk) => ({
      id: risk.id,
      companyName: risk.title.replace("Follow-up scaduto · ", ""),
      scheduledAt: new Date().toISOString(),
      priority: "high",
      href: risk.href,
    }));

  const lostClientRisks = joyData.risks.filter(
    (risk) => risk.id.startsWith("risk-inactive-") || risk.id.startsWith("risk-opp-")
  );

  const narrativeParts = [
    `${joyData.summary.visitsToday} visite oggi`,
    `${joyData.summary.agendaItems} impegni in agenda`,
    `${joyData.summary.overdueFollowUps} follow-up scaduti`,
    `pipeline ${formatOpportunityAmount(joyData.summary.pipelineValue)}`,
  ];

  return {
    headline: `Briefing del ${joyData.dateLabel}`,
    narrative: `Oggi hai ${narrativeParts.join(", ")}. Joy ha preparato priorità, percorso e azioni consigliate.`,
    priorityClients: joyData.suggestions.slice(0, 8),
    urgentOpportunities: openOpps,
    followUpsDue,
    recommendedRoute: {
      stops: joyData.dayPlan.length,
      estimatedKm: joyData.summary.estimatedTourKm,
      href: "/routes",
    },
    radarItems: missionData.radarItems,
    agendaItems: missionData.agendaItems.slice(0, 8),
    lostClientRisks,
  };
}

function buildFocusQueue(
  joyData: Awaited<ReturnType<typeof getJoyData>>
): JoyAutonomousFocusItem[] {
  const items: JoyAutonomousFocusItem[] = [];

  for (const planItem of joyData.dayPlan) {
    items.push({
      companyId: planItem.companyId,
      companyName: planItem.companyName,
      city: planItem.city,
      reason: `Visita oggi alle ${planItem.scheduledLabel}`,
      score: 100,
      href: `/joy/autonomous?focus=${planItem.companyId}`,
    });
  }

  for (const suggestion of joyData.suggestions) {
    items.push({
      companyId: suggestion.companyId,
      companyName: suggestion.companyName,
      city: suggestion.city,
      reason: suggestion.reasons[0] ?? "Cliente prioritario Joy",
      score: suggestion.score,
      href: `/joy/autonomous?focus=${suggestion.companyId}`,
    });
  }

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.companyId)) {
        return false;
      }
      seen.add(item.companyId);
      return true;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
}

export async function getJoyAutonomousData(): Promise<JoyAutonomousData> {
  const generatedAt = new Date().toISOString();

  try {
    const [joyData, missionData, overdueFollowUpsResult, overdueVisitsResult, opportunitiesResult] =
      await Promise.all([
        getJoyData(),
        getMissionControlData(),
        listFollowUps({ period: "overdue", limit: 20 }),
        listVisits({ period: "overdue", limit: 20 }),
        listOpportunities({ limit: 200 }),
      ]);

    const openOpportunities = (opportunitiesResult.data ?? []).filter((item) =>
      isOpenOpportunityStage(item.stage)
    );

    const briefing = buildMorningBriefing(joyData, missionData);
    const notifications = buildAutonomousNotifications({
      suggestions: joyData.suggestions,
      risks: joyData.risks,
      radarItems: missionData.radarItems,
      neverVisitedCompanies: joyData.summary.neverVisitedCompanies,
      overdueFollowUps: joyData.summary.overdueFollowUps,
      calendar: missionData.calendar,
    });

    const overdueVisits = overdueVisitsResult.data ?? [];

    const decisions = buildAutonomousDecisions({
      suggestions: joyData.suggestions,
      dayPlan: joyData.dayPlan,
      overdueFollowUps: overdueFollowUpsResult.data ?? [],
      overdueVisits,
      opportunities: openOpportunities,
      estimatedTourKm: joyData.summary.estimatedTourKm,
    });

    return {
      userName: joyData.userName,
      dateLabel: joyData.dateLabel,
      generatedAt,
      summary: joyData.summary,
      briefing,
      notifications,
      decisions,
      focusQueue: buildFocusQueue(joyData),
      dayPlan: joyData.dayPlan,
      calendar: missionData.calendar,
      error: joyData.error ?? missionData.error,
    };
  } catch (error) {
    return {
      userName: "Agente",
      dateLabel: new Date().toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      generatedAt,
      summary: {
        visitsToday: 0,
        agendaItems: 0,
        overdueFollowUps: 0,
        openOpportunities: 0,
        radarHits: 0,
        estimatedTourKm: 0,
        neverVisitedCompanies: 0,
        inactiveClients: 0,
        pipelineValue: 0,
      },
      briefing: {
        headline: "Briefing non disponibile",
        narrative: "Impossibile generare il piano autonomo in questo momento.",
        priorityClients: [],
        urgentOpportunities: [],
        followUpsDue: [],
        recommendedRoute: { stops: 0, estimatedKm: 0, href: "/routes" },
        radarItems: [],
        agendaItems: [],
        lostClientRisks: [],
      },
      notifications: [],
      decisions: [],
      focusQueue: [],
      dayPlan: [],
      calendar: {
        connected: false,
        configured: false,
        googleEmail: null,
        syncEnabled: false,
        lastSyncAt: null,
        lastSyncError: null,
        connectedAt: null,
        needsReconnect: false,
      },
      error: error instanceof Error ? error.message : "Errore Joy Autonomous.",
    };
  }
}
