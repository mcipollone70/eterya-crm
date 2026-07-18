import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { Button } from "@/components/ui";
import type { RecentActivityItem } from "../../types/intelligent-dashboard";
import { DashboardWidgetShell, WidgetEmptyState } from "./dashboard-widget-shell";

interface RecentActivitiesWidgetProps {
  items: RecentActivityItem[];
}

export function RecentActivitiesWidget({ items }: RecentActivitiesWidgetProps) {
  return (
    <DashboardWidgetShell
      title="Ultime attività"
      icon={<Clock3 className="h-4 w-4 text-slate-600" />}
      action={
        <Link href="/activities">
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-indigo-600">
            Tutte
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      }
    >
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[item.companyName, item.typeLabel].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-slate-400">
                  {item.occurredLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <WidgetEmptyState message="Nessuna attività recente registrata." />
      )}
    </DashboardWidgetShell>
  );
}
