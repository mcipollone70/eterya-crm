export type DashboardWidgetId =
  | "kpi-total-companies"
  | "kpi-prospects"
  | "kpi-clients"
  | "kpi-ex-clients"
  | "kpi-geocoded"
  | "kpi-needs-review"
  | "kpi-visits-today"
  | "kpi-visits-week"
  | "kpi-followups-today"
  | "kpi-open-opportunities"
  | "kpi-pipeline-value"
  | "kpi-never-visited"
  | "kpi-clients-inactive-90"
  | "chart-province"
  | "chart-commercial-status"
  | "chart-visits-trend"
  | "chart-opportunity-stage"
  | "chart-product-interests"
  | "chart-prospect-conversion"
  | "widget-upcoming-appointments"
  | "widget-overdue-activities"
  | "widget-recent-contacts"
  | "widget-top-opportunities"
  | "widget-today-tour";

export interface DashboardChartPoint {
  label: string;
  value: number;
}

export interface CommercialDashboardKpis {
  totalCompanies: number;
  prospects: number;
  clients: number;
  exClients: number;
  geocodedCompanies: number;
  needsReviewCompanies: number;
  visitsToday: number;
  visitsThisWeek: number;
  followUpsToday: number;
  openOpportunities: number;
  pipelineValue: number;
  neverVisitedCompanies: number;
  clientsWithoutVisit90Days: number;
}

export interface ProspectConversionChart {
  monthly: DashboardChartPoint[];
  conversionRate: number;
  prospects: number;
  clients: number;
}

export interface DashboardAppointmentItem {
  id: string;
  kind: "visit" | "follow_up";
  title: string;
  companyId: string;
  companyName: string | null;
  scheduledAt: string;
  href: string;
}

export interface DashboardOverdueItem {
  id: string;
  kind: "follow_up" | "activity";
  title: string;
  companyId: string | null;
  companyName: string | null;
  dueAt: string;
  href: string;
}

export interface DashboardOpportunityItem {
  id: string;
  title: string;
  companyId: string;
  companyName: string | null;
  stage: string;
  amount: number;
  href: string;
}

export interface DashboardTourItem {
  id: string;
  tourDate: string;
  stopsCount: number;
  status: string;
  estimatedMinutes: number | null;
  href: string;
}

export interface DashboardRecentContactItem {
  id: string;
  companyId: string;
  companyName: string | null;
  type: string;
  title: string;
  occurredAt: string;
  href: string;
}

export interface CommercialDashboardData {
  kpis: CommercialDashboardKpis;
  companiesByProvince: DashboardChartPoint[];
  companiesByCommercialStatus: DashboardChartPoint[];
  visitsMonthlyTrend: DashboardChartPoint[];
  opportunitiesByStage: DashboardChartPoint[];
  productInterests: DashboardChartPoint[];
  prospectConversion: ProspectConversionChart;
  upcomingAppointments: DashboardAppointmentItem[];
  overdueActivities: DashboardOverdueItem[];
  recentContacts: DashboardRecentContactItem[];
  topOpportunities: DashboardOpportunityItem[];
  todayTours: DashboardTourItem[];
}

export interface DashboardLayoutState {
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
}
