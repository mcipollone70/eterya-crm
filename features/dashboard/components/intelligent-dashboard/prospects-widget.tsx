import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { Button } from "@/components/ui";
import type { ProspectsToContactData } from "../../types/intelligent-dashboard";
import { DashboardWidgetShell, WidgetEmptyState, WidgetMetric } from "./dashboard-widget-shell";

interface ProspectsWidgetProps {
  data: ProspectsToContactData;
}

export function ProspectsWidget({ data }: ProspectsWidgetProps) {
  return (
    <DashboardWidgetShell
      title="Prospect da contattare"
      icon={<Target className="h-4 w-4 text-blue-600" />}
      action={
        <Link href="/companies?commercial_status=prospect&last_visit=never">
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-indigo-600">
            Apri elenco
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <WidgetMetric label="Mai contattati" value={data.neverContacted} tone="indigo" />
        <WidgetMetric label="Senza visita" value={data.noVisit} tone="amber" />
        <WidgetMetric label="Alta priorità" value={data.highPriority} tone="rose" />
      </div>

      {data.items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="block rounded-lg border border-slate-100 bg-white px-3 py-2.5 transition-colors hover:border-blue-100 hover:bg-blue-50/40"
              >
                <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {[item.city, item.reason].filter(Boolean).join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <WidgetEmptyState message="Nessun prospect urgente da contattare." />
        </div>
      )}
    </DashboardWidgetShell>
  );
}
