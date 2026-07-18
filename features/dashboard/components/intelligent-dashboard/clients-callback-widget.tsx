import Link from "next/link";
import { ArrowRight, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui";
import type { ClientsToCallbackData } from "../../types/intelligent-dashboard";
import { DashboardWidgetShell, WidgetEmptyState, WidgetMetric } from "./dashboard-widget-shell";

interface ClientsCallbackWidgetProps {
  data: ClientsToCallbackData;
}

export function ClientsCallbackWidget({ data }: ClientsCallbackWidgetProps) {
  return (
    <DashboardWidgetShell
      title="Clienti da richiamare"
      icon={<PhoneCall className="h-4 w-4 text-orange-600" />}
      action={
        <Link href="/activities?section=followups&fperiod=overdue">
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-indigo-600">
            Vedi attività
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <WidgetMetric label="Follow-up scaduti" value={data.overdueFollowUps} tone="rose" />
        <WidgetMetric label="Inattivi 90+ gg" value={data.inactiveClients90Days} tone="amber" />
        <WidgetMetric label="Attività aperte" value={data.openActivities} tone="indigo" />
      </div>

      {data.items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 transition-colors hover:border-orange-100 hover:bg-orange-50/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.companyName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{item.title}</p>
                </div>
                <span className="shrink-0 text-xs text-rose-600">{item.dueLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <WidgetEmptyState message="Nessun cliente urgente da richiamare." />
        </div>
      )}
    </DashboardWidgetShell>
  );
}
