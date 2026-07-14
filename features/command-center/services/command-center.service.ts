import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { listFollowUps } from "@/features/activities/services/follow-ups.service";
import {
  getMissionControlData,
  getUserScopedTodayVisitPlan,
} from "@/features/dashboard/services/mission-control.service";
import { buildAutonomousDecisions } from "@/features/joy/autonomous/utils/build-autonomous-decisions";
import { buildAutonomousNotifications } from "@/features/joy/autonomous/utils/build-autonomous-notifications";
import { listOpportunities } from "@/features/opportunities/services/opportunities.service";
import { listVisits } from "@/features/visits/services/visits.service";
import { getJoyData } from "@/features/joy/services/joy-ai.service";
import { normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import { isOpenOpportunityStage } from "@/lib/constants/opportunity-pipeline";
import { createServerClient } from "@/lib/supabase/server";
import type { MapCompany } from "@/features/maps/types/map";
import type { CommandCenterData, CommandCenterSyncStatus } from "../types/command-center";
import { buildCommandCenterDecisions } from "../utils/build-command-center-decisions";
import { buildCommandCenterMission } from "../utils/build-command-center-mission";
import { buildCommandCenterTimeline } from "../utils/build-command-center-timeline";

function resolveGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) {
    return "Buongiorno";
  }
  if (hour < 18) {
    return "Buon pomeriggio";
  }
  return "Buonasera";
}

function buildCrmSyncStatus(
  calendar: Awaited<ReturnType<typeof getMissionControlData>>["calendar"]
): CommandCenterSyncStatus {
  if (!calendar.configured) {
    return { label: "CRM operativo · Calendar non configurato", variant: "muted" };
  }
  if (!calendar.connected) {
    return { label: "CRM operativo · Calendar da collegare", variant: "warning" };
  }
  if (calendar.needsReconnect) {
    return { label: "CRM operativo · Riconnessione Calendar", variant: "danger" };
  }
  if (calendar.lastSyncError) {
    return { label: "CRM operativo · Sync con errori", variant: "danger" };
  }
  if (calendar.lastSyncAt) {
    const syncTime = new Date(calendar.lastSyncAt).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { label: `CRM sincronizzato · ${syncTime}`, variant: "success" };
  }
  return { label: "CRM sincronizzato", variant: "success" };
}

async function fetchMapCompaniesForIds(companyIds: string[]): Promise<MapCompany[]> {
  const uniqueIds = [...new Set(companyIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return [];
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("companies")
    .select(
      "id,name,city,province,latitude,longitude,commercial_status,geocode_status,address,street,street_number,postal_code,country,phone,contact_phone,mobile"
    )
    .in("id", uniqueIds.slice(0, 80));

  return (data ?? [])
    .filter((row) => row.latitude != null && row.longitude != null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone ?? row.contact_phone ?? row.mobile ?? null,
      city: row.city,
      province: row.province,
      commercial_status: normalizeCommercialStatus(row.commercial_status),
      geocode_status: row.geocode_status,
      latitude: row.latitude!,
      longitude: row.longitude!,
    }));
}

export async function getCommandCenterData(): Promise<CommandCenterData> {
  const now = new Date();
  const user = await getCurrentUser();
  const userId = user?.id ?? null;

  try {
    const [missionData, joyData, userDayPlan, overdueFollowUpsResult, overdueVisitsResult, opportunitiesResult] =
      await Promise.all([
        getMissionControlData(),
        getJoyData(),
        getUserScopedTodayVisitPlan(userId),
        listFollowUps({ period: "overdue", limit: 12 }),
        listVisits({ period: "overdue", limit: 12 }),
        listOpportunities({ limit: 100 }),
      ]);

    const openOpportunities = (opportunitiesResult.data ?? [])
      .filter((item) => isOpenOpportunityStage(item.stage))
      .slice(0, 8);

    const followUps = overdueFollowUpsResult.data ?? [];
    const agenda = missionData.agendaItems;
    const reminders = agenda.filter((item) => item.kind === "reminder");

    const mission = buildCommandCenterMission({
      summary: {
        ...joyData.summary,
        visitsToday: missionData.kpis.visitsToday,
        estimatedTourKm: missionData.kpis.estimatedTourKm,
      },
      dayPlan: userDayPlan,
      suggestions: joyData.suggestions,
    });

    const timeline = buildCommandCenterTimeline({
      dayPlan: userDayPlan,
      agendaItems: agenda,
    });

    const rawDecisions = buildAutonomousDecisions({
      suggestions: joyData.suggestions,
      dayPlan: userDayPlan,
      overdueFollowUps: followUps,
      overdueVisits: overdueVisitsResult.data ?? [],
      opportunities: openOpportunities,
      estimatedTourKm: missionData.kpis.estimatedTourKm,
    });

    const decisions = buildCommandCenterDecisions(rawDecisions);

    const notifications = buildAutonomousNotifications({
      suggestions: joyData.suggestions,
      risks: joyData.risks,
      radarItems: missionData.radarItems,
      neverVisitedCompanies: joyData.summary.neverVisitedCompanies,
      overdueFollowUps: joyData.summary.overdueFollowUps,
      calendar: missionData.calendar,
    });

    const mapCompanyIds = [
      ...userDayPlan.map((item) => item.companyId),
      ...missionData.radarItems.map((item) => item.companyId),
      ...joyData.suggestions.slice(0, 10).map((item) => item.companyId),
    ];

    const mapCompanies = await fetchMapCompaniesForIds(mapCompanyIds);

    return {
      userName: missionData.userName,
      dateLabel: missionData.dateLabel,
      greeting: resolveGreeting(now),
      weatherLabel: missionData.weatherLabel,
      calendar: missionData.calendar,
      crmSync: buildCrmSyncStatus(missionData.calendar),
      mission,
      timeline,
      decisions,
      radarItems: missionData.radarItems,
      mapCompanies,
      activities: {
        followUps: followUps.slice(0, 8),
        agenda: agenda.slice(0, 8),
        reminders: reminders.slice(0, 6),
        opportunities: openOpportunities,
      },
      notifications: notifications.slice(0, 12),
      error: joyData.error ?? missionData.error,
    };
  } catch (error) {
    return {
      userName: "Agente",
      dateLabel: now.toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      greeting: resolveGreeting(now),
      weatherLabel: "Meteo non disponibile",
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
      crmSync: { label: "CRM non disponibile", variant: "muted" },
      mission: {
        objective: "Configura il CRM per generare la missione del giorno.",
        potentialRevenue: 0,
        recommendedVisits: 0,
        estimatedKm: 0,
        estimatedTimeLabel: "—",
        priorityLabel: "—",
      },
      timeline: [],
      decisions: [],
      radarItems: [],
      mapCompanies: [],
      activities: {
        followUps: [],
        agenda: [],
        reminders: [],
        opportunities: [],
      },
      notifications: [],
      error: error instanceof Error ? error.message : "Errore Command Center.",
    };
  }
}
