import type { StatusBadgeModel } from "@/lib/integrations/status";
import type { CommercialKpiData } from "./commercial-kpi";

export interface IntelligentDashboardGreeting {
  salutation: string;
  userName: string;
  dateLabel: string;
  weekdayLabel: string;
}

export interface IntelligentDashboardOperationalStatus {
  crm: StatusBadgeModel;
  calendar: StatusBadgeModel;
  calendarConnectHref: string | null;
  calendarConnectLabel: string | null;
  calendarTooltip: string | null;
}

export interface TodayActivitiesData {
  appointmentsToday: number;
  plannedVisitsToday: number;
  openActivities: number;
  overdueActivities: number;
  previewItems: Array<{
    id: string;
    title: string;
    timeLabel: string;
    href: string;
  }>;
}

export interface ProspectContactItem {
  id: string;
  name: string;
  city: string | null;
  reason: string;
  href: string;
}

export interface ProspectsToContactData {
  neverContacted: number;
  noVisit: number;
  highPriority: number;
  items: ProspectContactItem[];
}

export interface ClientCallbackItem {
  id: string;
  title: string;
  companyName: string;
  dueLabel: string;
  href: string;
}

export interface ClientsToCallbackData {
  overdueFollowUps: number;
  inactiveClients90Days: number;
  openActivities: number;
  items: ClientCallbackItem[];
}

export interface DashboardStatisticsData {
  totalCompanies: number;
  clients: number;
  prospects: number;
  visitsThisWeek: number;
  visitsThisMonth: number;
}

export interface MapPreviewCompany {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  commercialStatus: string;
}

export interface QuickMapData {
  companies: MapPreviewCompany[];
  defaultCenter: { lat: number; lng: number };
}

export interface RecentActivityItem {
  id: string;
  title: string;
  companyName: string | null;
  occurredLabel: string;
  typeLabel: string;
  href: string;
}

export interface IntelligentDashboardData {
  greeting: IntelligentDashboardGreeting;
  operationalStatus: IntelligentDashboardOperationalStatus;
  todayActivities: TodayActivitiesData;
  prospects: ProspectsToContactData;
  clientsCallback: ClientsToCallbackData;
  statistics: DashboardStatisticsData;
  commercialKpi: CommercialKpiData;
  quickMap: QuickMapData;
  joySuggestions: string[];
  joySummary: string | null;
  recentActivities: RecentActivityItem[];
  error: string | null;
}
