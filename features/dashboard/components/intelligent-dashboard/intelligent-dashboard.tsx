import type { IntelligentDashboardData } from "../../types/intelligent-dashboard";
import { CentroOperativoWidget } from "./centro-operativo-widget";
import { ClientsCallbackWidget } from "./clients-callback-widget";
import { CommercialKpiWidget } from "./commercial-kpi-widget";
import { JoyAiWidget } from "./joy-ai-widget";
import { ProspectsWidget } from "./prospects-widget";
import { QuickActionsWidget } from "./quick-actions-widget";
import { QuickMapWidget } from "./quick-map-widget";
import { RecentActivitiesWidget } from "./recent-activities-widget";
import { StatisticsWidget } from "./statistics-widget";
import { TodayActivitiesWidget } from "./today-activities-widget";
import { WeatherWidget } from "./weather-widget";

interface IntelligentDashboardProps {
  data: IntelligentDashboardData;
}

export function IntelligentDashboard({ data }: IntelligentDashboardProps) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <CentroOperativoWidget
        greeting={data.greeting}
        crmStatus={data.operationalStatus.crm}
        calendarStatus={data.operationalStatus.calendar}
        calendarConnectHref={data.operationalStatus.calendarConnectHref}
        calendarConnectLabel={data.operationalStatus.calendarConnectLabel}
        calendarTooltip={data.operationalStatus.calendarTooltip}
        joySummary={data.joySummary}
      />

      {data.error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Alcuni dati potrebbero essere incompleti: {data.error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <TodayActivitiesWidget data={data.todayActivities} />
        <ProspectsWidget data={data.prospects} />
        <ClientsCallbackWidget data={data.clientsCallback} />
      </div>

      <CommercialKpiWidget data={data.commercialKpi} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StatisticsWidget data={data.statistics} />
        </div>
        <WeatherWidget />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <QuickMapWidget data={data.quickMap} />
        </div>
        <JoyAiWidget suggestions={data.joySuggestions} summary={data.joySummary} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivitiesWidget items={data.recentActivities} />
        <QuickActionsWidget />
      </div>
    </div>
  );
}
