import "server-only";

import { cache } from "react";
import { getCurrentUser, getCurrentUserProfile } from "@/features/auth/session";
import { listAgendaItems } from "@/features/agenda/services/agenda.service";
import { listRecentContactHistory } from "@/features/activities/services/contact-history.service";
import {
  getFollowUpDashboardMetrics,
  listFollowUps,
} from "@/features/activities/services/follow-ups.service";
import { getCommercialStatusCounts } from "@/features/companies/services/companies.service";
import {
  buildRowPriorityContext,
  fetchOpenOpportunityCompanyIds,
  getPriorityDashboardMetrics,
} from "@/features/companies/services/commercial-priority.service";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { computeCompanyPriorityFields } from "@/lib/commercial-priority/compute";
import type { CompanyPrioritySource } from "@/lib/commercial-priority/types";
import { getGoogleCalendarConnectionView } from "@/features/calendar-sync/services/connection.service";
import { getJoyCommandCenterSnapshot } from "@/features/joy/os/joy-os";
import { getVisitDashboardMetrics } from "@/features/visits/services/visits.service";
import { getCommercialKpiData } from "./commercial-kpi.service";
import { CONTACT_HISTORY_TYPE_LABELS } from "@/lib/constants/contact-history";
import { parseAgendaFilters } from "@/lib/constants/agenda";
import {
  buildCalendarStatusTooltip,
  resolveCalendarIntegrationStatus,
  resolveCrmStatus,
} from "@/lib/integrations/status";
import { startOfTodayIso } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import { fetchOverdueActivities } from "./commercial-dashboard-queries";
import {
  formatDashboardDateLabel,
  formatDashboardWeekdayLabel,
  resolveDisplayName,
  resolveGreetingSalutation,
} from "../utils/greeting";
import { formatScheduledTimeLabel } from "../utils/scheduled-day-label";
import type {
  ClientCallbackItem,
  IntelligentDashboardData,
  IntelligentDashboardOperationalStatus,
  MapPreviewCompany,
  ProspectContactItem,
  RecentActivityItem,
} from "../types/intelligent-dashboard";

function startOfMonthIso(): string {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (diffDays === 1) {
    return "Ieri";
  }
  if (diffDays < 7) {
    return `${diffDays} gg fa`;
  }

  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(date);
}

async function countVisitsThisMonth(userId: string | null): Promise<number> {
  const supabase = await createServerClient();
  const monthStart = startOfMonthIso();

  let query = supabase
    .from("visits")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("completed_at", monthStart);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { count } = await query;
  return count ?? 0;
}

async function fetchProspectPreview(userId: string | null): Promise<{
  neverContacted: number;
  noVisit: number;
  highPriority: number;
  items: ProspectContactItem[];
}> {
  const supabase = await createServerClient();

  let neverQuery = supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("commercial_status", "prospect")
    .is("last_contact_at", null);

  let noVisitQuery = supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("commercial_status", "prospect")
    .is("last_visit_at", null);

  let listQuery = supabase
    .from("companies")
    .select(
      "id,name,city,last_contact_at,last_visit_at,status,commercial_status,revenue,import_payload"
    )
    .eq("commercial_status", "prospect")
    .or("last_contact_at.is.null,last_visit_at.is.null")
    .order("updated_at", { ascending: false })
    .limit(40);

  if (userId) {
    neverQuery = applyAgentCompanyScope(neverQuery, userId);
    noVisitQuery = applyAgentCompanyScope(noVisitQuery, userId);
    listQuery = applyAgentCompanyScope(listQuery, userId);
  }

  const [neverRes, noVisitRes, listRes, openOpportunityCompanyIds] = await Promise.all([
    neverQuery,
    noVisitQuery,
    listQuery,
    fetchOpenOpportunityCompanyIds(),
  ]);

  const openOpportunitySet = new Set(openOpportunityCompanyIds);
  const scoredItems: Array<ProspectContactItem & { score: number; isHigh: boolean }> = [];

  for (const row of listRes.data ?? []) {
    const context = buildRowPriorityContext(
      row.id,
      row.last_visit_at ?? null,
      row.last_contact_at ?? null,
      openOpportunitySet
    );
    const priority = computeCompanyPriorityFields(row as CompanyPrioritySource, context);
    if (priority.priority_excluded) {
      continue;
    }

    const reasons: string[] = [];
    if (!row.last_contact_at) {
      reasons.push("Mai contattato");
    }
    if (!row.last_visit_at) {
      reasons.push("Senza visita");
    }
    if (priority.priority_tier === "high") {
      reasons.push("Alta priorità");
    }

    if (reasons.length === 0) {
      continue;
    }

    scoredItems.push({
      id: row.id,
      name: row.name,
      city: row.city,
      reason: reasons.join(" · "),
      href: `/companies/${row.id}`,
      score: priority.priority_score,
      isHigh: priority.priority_tier === "high",
    });
  }

  scoredItems.sort((left, right) => right.score - left.score);

  return {
    neverContacted: neverRes.count ?? 0,
    noVisit: noVisitRes.count ?? 0,
    highPriority: scoredItems.filter((item) => item.isHigh).length,
    items: scoredItems.slice(0, 5).map((item) => ({
      id: item.id,
      name: item.name,
      city: item.city,
      reason: item.reason,
      href: item.href,
    })),
  };
}

async function fetchMapPreviewCompanies(userId: string | null): Promise<MapPreviewCompany[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("companies")
    .select("id,name,latitude,longitude,commercial_status")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .in("geocode_status", ["geocoded", "completed"])
    .limit(60);

  if (userId) {
    query = applyAgentCompanyScope(query, userId);
  }

  const { data } = await query;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    commercialStatus: row.commercial_status ?? "prospect",
  }));
}

async function fetchActivityCounts(userId: string | null): Promise<{
  openActivities: number;
  overdueActivities: number;
}> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();

  let openQuery = supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .neq("status", "done");

  let overdueQuery = supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .neq("status", "done")
    .not("next_follow_up_at", "is", null)
    .lt("next_follow_up_at", todayStart);

  if (userId) {
    openQuery = openQuery.eq("user_id", userId);
    overdueQuery = overdueQuery.eq("user_id", userId);
  }

  const [openRes, overdueRes] = await Promise.all([openQuery, overdueQuery]);

  return {
    openActivities: openRes.count ?? 0,
    overdueActivities: overdueRes.count ?? 0,
  };
}

async function buildClientsCallback(
  inactiveClients90Days: number,
  openActivities: number
): Promise<{
  overdueFollowUps: number;
  inactiveClients90Days: number;
  openActivities: number;
  items: ClientCallbackItem[];
}> {
  const [followUpMetrics, overdueFollowUps] = await Promise.all([
    getFollowUpDashboardMetrics(),
    listFollowUps({ period: "overdue", limit: 5 }),
  ]);

  const items: ClientCallbackItem[] = (overdueFollowUps.data ?? []).map((item) => ({
    id: item.id,
    title: `Follow-up · ${item.activity_type}`,
    companyName: item.company_name ?? "Azienda",
    dueLabel: formatRelativeDate(item.effective_at),
    href: item.company_id ? `/companies/${item.company_id}` : "/activities?section=followups&fperiod=overdue",
  }));

  return {
    overdueFollowUps: followUpMetrics.data?.overdue ?? 0,
    inactiveClients90Days,
    openActivities,
    items,
  };
}

function mapRecentActivities(items: Awaited<ReturnType<typeof listRecentContactHistory>>["data"]): RecentActivityItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    companyName: item.company_name,
    occurredLabel: formatRelativeDate(item.occurred_at),
    typeLabel: CONTACT_HISTORY_TYPE_LABELS[item.type] ?? item.type,
    href: item.company_id ? `/companies/${item.company_id}` : "/activities",
  }));
}

export const getIntelligentDashboardData = cache(async (): Promise<IntelligentDashboardData> => {
  const now = new Date();
  const user = await getCurrentUser();
  const profile = await getCurrentUserProfile();
  const userId = user?.id ?? null;
  const userName = resolveDisplayName(profile?.fullName, profile?.email ?? user?.email);

  const greeting = {
    salutation: resolveGreetingSalutation(now),
    userName,
    dateLabel: formatDashboardDateLabel(now),
    weekdayLabel: formatDashboardWeekdayLabel(now),
  };

  const buildOperationalStatus = (
    calendar: Awaited<ReturnType<typeof getGoogleCalendarConnectionView>>,
    operational: boolean
  ): IntelligentDashboardOperationalStatus => {
    const calendarStatus = resolveCalendarIntegrationStatus(calendar);
    const needsLink =
      calendar.configured && (!calendar.connected || calendar.needsReconnect);
    return {
      crm: resolveCrmStatus(operational),
      calendar: calendarStatus,
      calendarConnectHref: needsLink ? "/settings" : null,
      calendarConnectLabel: calendar.needsReconnect
        ? "Ricollega calendario"
        : "Collega calendario",
      calendarTooltip: buildCalendarStatusTooltip(calendar),
    };
  };

  try {
    const supabase = await createServerClient();
    const todayIso = now.toISOString().slice(0, 10);

    const [
      agendaResult,
      followUpMetrics,
      activityCounts,
      overdueActivities,
      priorityMetrics,
      statusCounts,
      visitMetrics,
      visitsThisMonth,
      prospectsPreview,
      mapCompanies,
      joySnapshot,
      recentContactsResult,
      commercialKpi,
      calendarConnection,
    ] = await Promise.all([
      listAgendaItems(
        parseAgendaFilters({
          view: "day",
          date: todayIso,
          agent: userId ?? undefined,
          status: "open",
        })
      ),
      getFollowUpDashboardMetrics(),
      fetchActivityCounts(userId),
      fetchOverdueActivities(
        supabase,
        userId
          ? { agentId: userId, province: null, commercialStatus: null, period: "" }
          : undefined
      ),
      getPriorityDashboardMetrics(),
      getCommercialStatusCounts(),
      getVisitDashboardMetrics(),
      countVisitsThisMonth(userId),
      fetchProspectPreview(userId),
      fetchMapPreviewCompanies(userId),
      getJoyCommandCenterSnapshot({
        userId,
        trigger: "proactive_tick",
        hour: now.getHours(),
      }),
      listRecentContactHistory(8),
      getCommercialKpiData(),
      getGoogleCalendarConnectionView(),
    ]);

    const agendaItems = agendaResult.data ?? [];
    const plannedVisitsToday = agendaItems.filter((item) => item.kind === "visit").length;
    const appointmentsToday = agendaItems.length;

    const clientsCallback = await buildClientsCallback(
      visitMetrics.data?.clientsWithoutVisit90Days ?? priorityMetrics.data?.inactiveClients90Days ?? 0,
      activityCounts.openActivities
    );

    const counts = statusCounts.data;
    const totalCompanies =
      (counts?.prospect ?? 0) +
      (counts?.cliente ?? 0) +
      (counts?.ex_cliente ?? 0) +
      (counts?.da_ricontattare ?? 0);

    const previewItems = agendaItems.slice(0, 4).map((item) => ({
      id: item.id,
      title: item.title,
      timeLabel: formatScheduledTimeLabel(item.scheduledAt),
      href:
        item.kind === "visit" && item.companyId
          ? `/visits?company=${item.companyId}`
          : "/agenda",
    }));

    const defaultCenter =
      mapCompanies.length > 0
        ? {
            lat: mapCompanies.reduce((sum, c) => sum + c.latitude, 0) / mapCompanies.length,
            lng: mapCompanies.reduce((sum, c) => sum + c.longitude, 0) / mapCompanies.length,
          }
        : { lat: 41.8719, lng: 12.5674 };

    const errors = [
      agendaResult.error,
      statusCounts.error,
      visitMetrics.error,
      recentContactsResult.error,
      commercialKpi.error,
    ].filter(Boolean);

    return {
      greeting,
      operationalStatus: buildOperationalStatus(calendarConnection, true),
      todayActivities: {
        appointmentsToday,
        plannedVisitsToday,
        openActivities: activityCounts.openActivities,
        overdueActivities:
          activityCounts.overdueActivities + (followUpMetrics.data?.overdue ?? 0) + overdueActivities.length,
        previewItems,
      },
      prospects: {
        ...prospectsPreview,
        highPriority: priorityMetrics.data?.highPriority ?? prospectsPreview.highPriority,
      },
      clientsCallback,
      statistics: {
        totalCompanies,
        clients: counts?.cliente ?? 0,
        prospects: counts?.prospect ?? 0,
        visitsThisWeek: visitMetrics.data?.visitsThisWeek ?? 0,
        visitsThisMonth,
      },
      commercialKpi,
      quickMap: {
        companies: mapCompanies,
        defaultCenter,
      },
      joySuggestions: [
        joySnapshot.recommendedPrompt,
        ...joySnapshot.adviceNow.map((card) => card.action),
        ...joySnapshot.strategyChips.slice(0, 2).map((chip) => chip.prompt),
      ]
        .filter(Boolean)
        .slice(0, 6),
      joySummary: joySnapshot.syntheticSummary,
      recentActivities: mapRecentActivities(recentContactsResult.data),
      error: errors[0] ?? null,
    };
  } catch (error) {
    const calendarConnection = await getGoogleCalendarConnectionView().catch(
      (): Awaited<ReturnType<typeof getGoogleCalendarConnectionView>> => ({
        connected: false,
        configured: false,
        googleEmail: null,
        syncEnabled: false,
        lastSyncAt: null,
        lastSyncError: null,
        connectedAt: null,
        needsReconnect: false,
        syncInProgress: false,
        temporaryError: false,
      })
    );

    return {
      greeting,
      operationalStatus: buildOperationalStatus(calendarConnection, false),
      todayActivities: {
        appointmentsToday: 0,
        plannedVisitsToday: 0,
        openActivities: 0,
        overdueActivities: 0,
        previewItems: [],
      },
      prospects: {
        neverContacted: 0,
        noVisit: 0,
        highPriority: 0,
        items: [],
      },
      clientsCallback: {
        overdueFollowUps: 0,
        inactiveClients90Days: 0,
        openActivities: 0,
        items: [],
      },
      statistics: {
        totalCompanies: 0,
        clients: 0,
        prospects: 0,
        visitsThisWeek: 0,
        visitsThisMonth: 0,
      },
      commercialKpi: {
        pipelineValue: 0,
        openOpportunities: 0,
        wonCount: 0,
        lostCount: 0,
        conversionRate: 0,
        stageValues: [],
        quotesSent: 0,
        quotesAccepted: 0,
        quotesSentValue: 0,
        quotesAcceptedValue: 0,
        quoteAcceptanceRate: 0,
        ordersCount: 0,
        ordersValue: 0,
        samplesOutstanding: 0,
        samplesPurchased: 0,
        serviceOpenTickets: 0,
        error: null,
      },
      quickMap: {
        companies: [],
        defaultCenter: { lat: 41.8719, lng: 12.5674 },
      },
      joySuggestions: [],
      joySummary: null,
      recentActivities: [],
      error: error instanceof Error ? error.message : "Impossibile caricare la dashboard.",
    };
  }
});
