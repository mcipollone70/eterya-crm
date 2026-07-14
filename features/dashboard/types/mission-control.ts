import type { LucideIcon } from "lucide-react";
import type { AgendaItem } from "@/lib/constants/agenda";
import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";
import type { GoogleCalendarConnectionView } from "@/lib/google-calendar/types";
import type { OpportunityRadarItem } from "@/features/radar/types";

export type MissionActionIcon =
  | "phone"
  | "calendar"
  | "check"
  | "map-pin"
  | "route"
  | "target";

export interface MissionControlKpis {
  visitsToday: number;
  overdueFollowUps: number;
  hotOpportunities: number;
  prospectsToVisit: number;
  estimatedTourKm: number;
  pipelineValue: number;
}

export interface MissionControlAction {
  id: string;
  icon: MissionActionIcon;
  title: string;
  explanation: string;
  href: string;
  actionLabel: string;
  external?: boolean;
}

export interface MissionControlNextVisit {
  visitId: string;
  companyId: string;
  companyName: string;
  scheduledAt: string;
  scheduledLabel: string;
  phone: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
}

export interface MissionControlData {
  userName: string;
  dateLabel: string;
  weatherLabel: string;
  calendar: GoogleCalendarConnectionView;
  kpis: MissionControlKpis;
  actions: MissionControlAction[];
  nextVisit: MissionControlNextVisit | null;
  radarItems: OpportunityRadarItem[];
  agendaItems: AgendaItem[];
  error: string | null;
}

export interface MissionControlSuggestionCard {
  suggestion: DailyVisitSuggestion;
}

export type MissionKpiIcon = LucideIcon;
