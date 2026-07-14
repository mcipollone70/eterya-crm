import "server-only";

import { getCurrentUser, getCurrentUserProfile } from "@/features/auth/session";
import { getGoogleCalendarConnectionView } from "@/features/calendar-sync/services/connection.service";
import { listAgendaItems } from "@/features/agenda/services/agenda.service";
import { getFollowUpDashboardMetrics } from "@/features/activities/services/follow-ups.service";
import { getDailyVisitSuggestions } from "@/features/assistant/services/assistant-suggestions.service";
import { getPriorityDashboardMetrics } from "@/features/companies/services/commercial-priority.service";
import { getOpportunityDashboardMetrics } from "@/features/opportunities/services/opportunities.service";
import { analyzeOpportunityRadar } from "@/features/radar/services/opportunity-radar.service";
import { getValidMapCoordinates } from "@/features/radar/utils/map-coordinates";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import { parseAgendaFilters } from "@/lib/constants/agenda";
import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";
import { OPEN_OPPORTUNITY_STAGES } from "@/lib/constants/opportunity-pipeline";
import { endOfTodayIso, startOfTodayIso } from "@/lib/last-visit/format";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import {
  formatScheduledDayLabel,
  formatScheduledTimeLabel,
} from "../utils/scheduled-day-label";
import { fetchWeatherLabel } from "../utils/weather";
import type {
  MissionControlAction,
  MissionControlData,
  MissionControlKpis,
  MissionControlNextVisit,
} from "../types/mission-control";

function formatItalianDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function resolveDisplayName(fullName: string | null | undefined, email: string | null | undefined): string {
  if (fullName?.trim()) {
    return fullName.trim();
  }
  if (email?.trim()) {
    return email.split("@")[0] ?? "Agente";
  }
  return "Agente";
}

function buildMissionActions(
  suggestions: DailyVisitSuggestion[],
  nextVisit: MissionControlNextVisit | null,
  estimatedTourKm: number
): MissionControlAction[] {
  type ScoredAction = MissionControlAction & { priority: number };
  const candidates: ScoredAction[] = [];

  if (nextVisit) {
    const isDue = new Date(nextVisit.scheduledAt).getTime() <= Date.now();
    if (isDue) {
      candidates.push({
        id: `complete-${nextVisit.visitId}`,
        icon: "check",
        title: `Completa visita · ${nextVisit.companyName}`,
        explanation: `Appuntamento delle ${nextVisit.scheduledLabel}`,
        href: companyRegisterVisitHref(nextVisit.companyId),
        actionLabel: "Completa visita",
        priority: 100,
      });
    }
  }

  for (const suggestion of suggestions) {
    const explanation = suggestion.reasons.join(" · ");

    if (suggestion.signals.hasOverdueFollowUp) {
      candidates.push({
        id: `follow-up-${suggestion.companyId}`,
        icon: "calendar",
        title: `Pianifica follow-up · ${suggestion.companyName}`,
        explanation,
        href: `/activities?section=followups&fcompany=${suggestion.companyId}`,
        actionLabel: "Pianifica follow-up",
        priority: suggestion.score + 15,
      });
      continue;
    }

    if (suggestion.signals.openOpportunityCount > 0) {
      candidates.push({
        id: `call-${suggestion.companyId}`,
        icon: "phone",
        title: `Chiama ${suggestion.companyName}`,
        explanation,
        href: `/companies/${suggestion.companyId}`,
        actionLabel: "Apri scheda",
        priority: suggestion.score + 10,
      });
      continue;
    }

    if (suggestion.signals.distanceKm != null && suggestion.signals.distanceKm <= 10) {
      candidates.push({
        id: `nearby-${suggestion.companyId}`,
        icon: "map-pin",
        title: `Visita cliente vicino · ${suggestion.companyName}`,
        explanation,
        href: `/visits?company=${suggestion.companyId}&briefing=${suggestion.companyId}`,
        actionLabel: "Apri briefing",
        priority: suggestion.score + 8,
      });
      continue;
    }

    candidates.push({
      id: `visit-${suggestion.companyId}`,
      icon: "target",
      title: `Visita ${suggestion.companyName}`,
      explanation,
      href: `/assistant?briefing=${suggestion.companyId}`,
      actionLabel: "Briefing AI",
      priority: suggestion.score,
    });
  }

  if (estimatedTourKm > 0) {
    candidates.push({
      id: "plan-tour",
      icon: "route",
      title: "Pianifica il giro",
      explanation: `${estimatedTourKm.toFixed(1)} km stimati tra le visite di oggi`,
      href: "/routes",
      actionLabel: "Apri giro",
      priority: 45,
    });
  }

  return candidates
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 5)
    .map(({ priority: _priority, ...action }) => action);
}

async function countVisitsToday(userId: string | null): Promise<number> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();

  let scheduledQuery = supabase
    .from("visits")
    .select("id", { count: "exact", head: true })
    .in("status", ["scheduled", "in_progress", "completed"])
    .gte("scheduled_at", todayStart)
    .lte("scheduled_at", todayEnd);

  let completedQuery = supabase
    .from("visits")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("completed_at", todayStart)
    .lte("completed_at", todayEnd);

  if (userId) {
    scheduledQuery = scheduledQuery.eq("user_id", userId);
    completedQuery = completedQuery.eq("user_id", userId);
  }

  const [scheduledRes, completedRes] = await Promise.all([scheduledQuery, completedQuery]);
  const error = scheduledRes.error ?? completedRes.error;
  if (error) {
    throw new Error(describeDbError(error) ?? "Conteggio visite non riuscito.");
  }

  return Math.max(scheduledRes.count ?? 0, completedRes.count ?? 0);
}

async function estimateTodayTourKm(userId: string | null): Promise<number> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();

  let query = supabase
    .from("visits")
    .select("scheduled_at,companies(latitude,longitude)")
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_at", todayStart)
    .lte("scheduled_at", todayEnd)
    .order("scheduled_at", { ascending: true });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return 0;
  }

  type VisitTourRow = {
    scheduled_at: string;
    companies:
      | { latitude: number | null; longitude: number | null }
      | Array<{ latitude: number | null; longitude: number | null }>
      | null;
  };

  const points: Array<{ lat: number; lng: number }> = [];
  for (const row of data as VisitTourRow[]) {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    if (company?.latitude != null && company?.longitude != null) {
      points.push({ lat: company.latitude, lng: company.longitude });
    }
  }

  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += getDistanceKm(
      points[index - 1].lat,
      points[index - 1].lng,
      points[index].lat,
      points[index].lng
    );
  }

  return Math.round(total * 10) / 10;
}

async function countHotOpportunities(userId: string | null): Promise<number> {
  const supabase = await createServerClient();

  let query = supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .in("stage", [...OPEN_OPPORTUNITY_STAGES])
    .gte("probability", 70);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { count, error } = await query;
  if (error) {
    return 0;
  }

  return count ?? 0;
}

async function getNextScheduledVisit(userId: string | null): Promise<MissionControlNextVisit | null> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();

  type VisitNextRow = {
    id: string;
    company_id: string;
    scheduled_at: string;
    notes: string | null;
    companies:
      | {
          name: string;
          phone: string | null;
          contact_phone: string | null;
          mobile: string | null;
          latitude: number | null;
          longitude: number | null;
        }
      | Array<{
          name: string;
          phone: string | null;
          contact_phone: string | null;
          mobile: string | null;
          latitude: number | null;
          longitude: number | null;
        }>
      | null;
  };

  let query = supabase
    .from("visits")
    .select(
      "id,company_id,scheduled_at,notes,companies(name,phone,contact_phone,mobile,latitude,longitude)"
    )
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_at", todayStart)
    .order("scheduled_at", { ascending: true })
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.limit(1);
  const row = (data as VisitNextRow[] | null)?.[0];
  if (error || !row) {
    return null;
  }

  const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
  const phone = company?.phone ?? company?.contact_phone ?? company?.mobile ?? null;

  return {
    visitId: row.id,
    companyId: row.company_id,
    companyName: company?.name ?? "Azienda",
    scheduledAt: row.scheduled_at,
    scheduledDayLabel: formatScheduledDayLabel(row.scheduled_at),
    scheduledLabel: formatScheduledTimeLabel(row.scheduled_at),
    phone,
    notes: row.notes,
    latitude: company?.latitude ?? null,
    longitude: company?.longitude ?? null,
    distanceKm: null,
  };
}

async function getRadarPreview(userId: string | null): Promise<MissionControlData["radarItems"]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("companies")
    .select("id,latitude,longitude,commercial_status")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .in("commercial_status", ["prospect", "cliente"])
    .limit(250);

  if (userId) {
    query = applyAgentCompanyScope(query, userId);
  }

  const { data } = await query;
  const companies = data ?? [];
  if (companies.length === 0) {
    return [];
  }

  const centerLat =
    companies.reduce((sum, row) => sum + Number(row.latitude), 0) / companies.length;
  const centerLng =
    companies.reduce((sum, row) => sum + Number(row.longitude), 0) / companies.length;

  const result = await analyzeOpportunityRadar({
    centerLat,
    centerLng,
    radiusKm: 10,
    companyIds: companies.map((row) => row.id),
  });

  return result.items.slice(0, 3);
}

async function fetchCompanyCoordinatesByIds(
  companyIds: string[]
): Promise<Map<string, { latitude: number; longitude: number }>> {
  const uniqueIds = [...new Set(companyIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("companies")
    .select("id,latitude,longitude")
    .in("id", uniqueIds);

  const coordinates = new Map<string, { latitude: number; longitude: number }>();

  for (const row of data ?? []) {
    const coords = getValidMapCoordinates(row.latitude, row.longitude);
    if (coords) {
      coordinates.set(row.id, coords);
    }
  }

  return coordinates;
}

async function mapRadarFromSuggestions(
  suggestions: DailyVisitSuggestion[]
): Promise<MissionControlData["radarItems"]> {
  const slice = suggestions.slice(0, 3);
  const coordinatesById = await fetchCompanyCoordinatesByIds(
    slice.map((item) => item.companyId)
  );

  return slice.map((item) => {
    const coordinates = coordinatesById.get(item.companyId);

    return {
      companyId: item.companyId,
      companyName: item.companyName,
      city: item.city,
      province: item.province,
      phone: null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      commercialStatus: item.commercialStatus as MissionControlData["radarItems"][number]["commercialStatus"],
      distanceKm: item.signals.distanceKm ?? 0,
      score: item.score,
      tier: item.tier,
      priorityScore: item.score,
      opportunityValue: item.signals.openPipelineValue,
      lastVisitLabel:
        item.signals.daysSinceLastVisit == null
          ? "Mai visitata"
          : `${item.signals.daysSinceLastVisit} gg fa`,
      primaryReason: item.reasons[0] ?? "Priorità commerciale",
      reasons: item.reasons,
    };
  });
}

export async function getMissionControlData(): Promise<MissionControlData> {
  const now = new Date();
  const user = await getCurrentUser();
  const profile = await getCurrentUserProfile();
  const userId = user?.id ?? null;
  const userName = resolveDisplayName(profile?.fullName, profile?.email ?? user?.email);

  try {
    const [
      calendar,
      visitsToday,
      followUpMetrics,
      opportunityMetrics,
      priorityMetrics,
      hotOpportunities,
      suggestionsResult,
      nextVisit,
      estimatedTourKm,
      agendaResult,
      radarItems,
    ] = await Promise.all([
      getGoogleCalendarConnectionView(),
      countVisitsToday(userId),
      getFollowUpDashboardMetrics(),
      getOpportunityDashboardMetrics(),
      getPriorityDashboardMetrics(),
      countHotOpportunities(userId),
      getDailyVisitSuggestions({ limit: 8, agentId: userId }),
      getNextScheduledVisit(userId),
      estimateTodayTourKm(userId),
      listAgendaItems(
        parseAgendaFilters({
          view: "day",
          date: now.toISOString().slice(0, 10),
          agent: userId ?? undefined,
          status: "open",
        })
      ),
      getRadarPreview(userId),
    ]);

    const weatherLabel = await fetchWeatherLabel(
      nextVisit?.latitude ?? 41.8719,
      nextVisit?.longitude ?? 12.5674
    );

    const suggestions = suggestionsResult.data ?? [];
    const kpis: MissionControlKpis = {
      visitsToday,
      overdueFollowUps: followUpMetrics.data?.overdue ?? 0,
      hotOpportunities,
      prospectsToVisit: priorityMetrics.data?.unvisitedProspects ?? 0,
      estimatedTourKm,
      pipelineValue: opportunityMetrics.data?.pipelineValue ?? 0,
    };

    const actions = buildMissionActions(suggestions, nextVisit, estimatedTourKm);
    const agendaItems = (agendaResult.data ?? [])
      .filter((item) => new Date(item.scheduledAt).getTime() >= now.getTime())
      .slice(0, 5);

    const radar =
      radarItems.length > 0 ? radarItems : await mapRadarFromSuggestions(suggestions);

    const errors = [
      suggestionsResult.error,
      agendaResult.error,
      followUpMetrics.error,
      opportunityMetrics.error,
      priorityMetrics.error,
    ].filter(Boolean);

    return {
      userName,
      dateLabel: formatItalianDate(now),
      weatherLabel,
      calendar,
      kpis,
      actions,
      nextVisit,
      radarItems: radar,
      agendaItems,
      error: errors[0] ?? null,
    };
  } catch (error) {
    return {
      userName,
      dateLabel: formatItalianDate(now),
      weatherLabel: "Meteo non disponibile",
      calendar: await getGoogleCalendarConnectionView(),
      kpis: {
        visitsToday: 0,
        overdueFollowUps: 0,
        hotOpportunities: 0,
        prospectsToVisit: 0,
        estimatedTourKm: 0,
        pipelineValue: 0,
      },
      actions: [],
      nextVisit: null,
      radarItems: [],
      agendaItems: [],
      error: error instanceof Error ? error.message : "Impossibile caricare Mission Control.",
    };
  }
}
