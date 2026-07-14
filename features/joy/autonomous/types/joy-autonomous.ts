import type { AgendaItem } from "@/lib/constants/agenda";
import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";
import type { GoogleCalendarConnectionView } from "@/lib/google-calendar/types";
import type { OpportunityRadarItem } from "@/features/radar/types";
import type { JoyCopilotOperation } from "../../chat/types/joy-chat";
import type { JoyDayPlanItem, JoyRiskItem, JoySummary } from "../../types/joy-data";

export type JoyAutonomousTab = "dashboard" | "notifications" | "decisions" | "focus";

export type JoyAutonomousNotificationKind =
  | "no_visits"
  | "overdue_followup"
  | "stale_opportunity"
  | "nearby_company"
  | "reschedule_visit"
  | "calendar_unsynced";

export type JoyAutonomousDecisionIcon =
  | "visit"
  | "follow_up"
  | "reminder"
  | "route"
  | "agenda"
  | "briefing"
  | "call"
  | "navigate";

export interface JoyAutonomousMorningBriefing {
  headline: string;
  narrative: string;
  priorityClients: DailyVisitSuggestion[];
  urgentOpportunities: Array<{
    id: string;
    title: string;
    companyName: string | null;
    amount: number;
    probability: number | null;
    href: string;
  }>;
  followUpsDue: Array<{
    id: string;
    companyName: string | null;
    scheduledAt: string;
    priority: string;
    href: string;
  }>;
  recommendedRoute: {
    stops: number;
    estimatedKm: number;
    href: string;
  };
  radarItems: OpportunityRadarItem[];
  agendaItems: AgendaItem[];
  lostClientRisks: JoyRiskItem[];
}

export interface JoyAutonomousNotification {
  id: string;
  kind: JoyAutonomousNotificationKind;
  title: string;
  explanation: string;
  severity: "high" | "medium" | "low";
  companyId?: string;
  href?: string;
}

export interface JoyAutonomousDecision {
  id: string;
  icon: JoyAutonomousDecisionIcon;
  title: string;
  motivation: string;
  estimatedImpact: string;
  impactScore: number;
  actionLabel: string;
  operation?: JoyCopilotOperation;
  href?: string;
}

export interface JoyAutonomousFocusItem {
  companyId: string;
  companyName: string;
  city: string | null;
  reason: string;
  score: number;
  href: string;
}

export interface JoyAutonomousData {
  userName: string;
  dateLabel: string;
  generatedAt: string;
  summary: JoySummary;
  briefing: JoyAutonomousMorningBriefing;
  notifications: JoyAutonomousNotification[];
  decisions: JoyAutonomousDecision[];
  focusQueue: JoyAutonomousFocusItem[];
  dayPlan: JoyDayPlanItem[];
  calendar: GoogleCalendarConnectionView;
  error: string | null;
}
