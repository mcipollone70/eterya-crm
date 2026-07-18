import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui";
import type { TodayActivitiesData } from "../../types/intelligent-dashboard";
import { DashboardWidgetShell, WidgetEmptyState, WidgetMetric } from "./dashboard-widget-shell";

interface TodayActivitiesWidgetProps {
  data: TodayActivitiesData;
}

export function TodayActivitiesWidget({ data }: TodayActivitiesWidgetProps) {
  return (
    <DashboardWidgetShell
      title="Le attività di oggi"
      icon={<CalendarDays className="h-4 w-4 text-indigo-600" />}
      action={
        <Link href="/agenda">
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-indigo-600">
            Vai all&apos;Agenda
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <WidgetMetric label="Appuntamenti" value={data.appointmentsToday} tone="indigo" />
        <WidgetMetric label="Visite pianificate" value={data.plannedVisitsToday} tone="emerald" />
        <WidgetMetric label="Attività aperte" value={data.openActivities} tone="amber" />
        <WidgetMetric label="In ritardo" value={data.overdueActivities} tone="rose" />
      </div>

      {data.previewItems.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {data.previewItems.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm transition-colors hover:border-indigo-100 hover:bg-indigo-50/50"
              >
                <span className="min-w-0 truncate font-medium text-slate-800">{item.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">{item.timeLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <WidgetEmptyState message="Nessuna attività in programma per oggi." />
        </div>
      )}
    </DashboardWidgetShell>
  );
}
