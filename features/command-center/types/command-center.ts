import type { AgendaItem } from "@/lib/constants/agenda";
import type { GoogleCalendarConnectionView } from "@/lib/google-calendar/types";
import type { OpportunityRadarItem } from "@/features/radar/types";
import type { MapCompany } from "@/features/maps/types/map";
import type { FollowUpListItem } from "@/features/activities/services/follow-ups.service";
import type { OpportunityListItem } from "@/features/opportunities/services/opportunities.service";
import type { JoyAutonomousNotification } from "@/features/joy/autonomous/types/joy-autonomous";
import type { JoyCopilotOperation } from "@/features/joy/chat/types/joy-chat";

export type CommandCenterDecisionIcon =
  | "visit"
  | "follow_up"
  | "reminder"
  | "route"
  | "agenda"
  | "briefing"
  | "call"
  | "navigate";

export interface CommandCenterSyncStatus {
  label: string;
  variant: "success" | "warning" | "danger" | "muted" | "default" | "info";
}

export interface CommandCenterMission {
  objective: string;
  potentialRevenue: number;
  recommendedVisits: number;
  estimatedKm: number;
  estimatedTimeLabel: string;
  priorityLabel: string;
}

export interface CommandCenterTimelineItem {
  id: string;
  scheduledAt: string;
  timeLabel: string;
  companyId: string;
  companyName: string;
  city: string | null;
  distanceLabel: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  visitId?: string;
  kind: "visit" | "agenda";
}

export interface CommandCenterDecision {
  id: string;
  icon: CommandCenterDecisionIcon;
  title: string;
  motivation: string;
  estimatedImpact: string;
  estimatedTimeLabel: string;
  impactScore: number;
  actionLabel: string;
  operation?: JoyCopilotOperation;
  href?: string;
}

export interface CommandCenterActivities {
  followUps: FollowUpListItem[];
  agenda: AgendaItem[];
  reminders: AgendaItem[];
  opportunities: OpportunityListItem[];
}

export interface CommandCenterData {
  userName: string;
  dateLabel: string;
  greeting: string;
  weatherLabel: string;
  calendar: GoogleCalendarConnectionView;
  crmSync: CommandCenterSyncStatus;
  mission: CommandCenterMission;
  timeline: CommandCenterTimelineItem[];
  decisions: CommandCenterDecision[];
  radarItems: OpportunityRadarItem[];
  mapCompanies: MapCompany[];
  activities: CommandCenterActivities;
  notifications: JoyAutonomousNotification[];
  error: string | null;
}
