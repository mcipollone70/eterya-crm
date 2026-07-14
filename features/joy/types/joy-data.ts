import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";
import type { VisitStatus } from "@/lib/supabase/types";

export type JoyInsightIcon =
  | "sparkles"
  | "phone"
  | "map-pin"
  | "target"
  | "calendar"
  | "route"
  | "alert"
  | "flame";

export interface JoyInsight {
  id: string;
  icon: JoyInsightIcon;
  title: string;
  explanation: string;
  href: string;
  actionLabel: string;
  priority: number;
}

export interface JoyRiskItem {
  id: string;
  title: string;
  explanation: string;
  href: string;
  severity: "high" | "medium";
}

export interface JoyOpportunityGroup {
  id: string;
  title: string;
  explanation: string;
  companies: Array<{ id: string; name: string; city: string | null }>;
  href: string;
}

export interface JoyDayPlanItem {
  visitId: string;
  companyId: string;
  companyName: string;
  city: string | null;
  province: string | null;
  scheduledAt: string;
  scheduledLabel: string;
  status: VisitStatus;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
}

export interface JoySummary {
  visitsToday: number;
  agendaItems: number;
  overdueFollowUps: number;
  openOpportunities: number;
  radarHits: number;
  estimatedTourKm: number;
  neverVisitedCompanies: number;
  inactiveClients: number;
  pipelineValue: number;
}

export interface JoyData {
  userName: string;
  dateLabel: string;
  summary: JoySummary;
  recommendations: JoyInsight[];
  risks: JoyRiskItem[];
  opportunities: JoyOpportunityGroup[];
  dayPlan: JoyDayPlanItem[];
  suggestions: DailyVisitSuggestion[];
  error: string | null;
}
