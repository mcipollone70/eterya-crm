import Link from "next/link";
import { BarChart3, Building2, MapPin, Target, TrendingUp } from "lucide-react";
import type { DashboardStatisticsData } from "../../types/intelligent-dashboard";
import { DashboardWidgetShell } from "./dashboard-widget-shell";

interface StatisticsWidgetProps {
  data: DashboardStatisticsData;
}

const STATS = [
  {
    key: "totalCompanies" as const,
    label: "Aziende totali",
    icon: Building2,
    href: "/companies",
    tone: "text-indigo-600 bg-indigo-50",
  },
  {
    key: "clients" as const,
    label: "Clienti",
    icon: TrendingUp,
    href: "/companies?commercial_status=cliente",
    tone: "text-emerald-600 bg-emerald-50",
  },
  {
    key: "prospects" as const,
    label: "Prospect",
    icon: Target,
    href: "/companies?commercial_status=prospect",
    tone: "text-blue-600 bg-blue-50",
  },
  {
    key: "visitsThisWeek" as const,
    label: "Visite settimana",
    icon: MapPin,
    href: "/visits",
    tone: "text-violet-600 bg-violet-50",
  },
  {
    key: "visitsThisMonth" as const,
    label: "Visite mese",
    icon: BarChart3,
    href: "/visits",
    tone: "text-amber-600 bg-amber-50",
  },
];

export function StatisticsWidget({ data }: StatisticsWidgetProps) {
  return (
    <DashboardWidgetShell
      title="Statistiche"
      icon={<BarChart3 className="h-4 w-4 text-violet-600" />}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          const value = data[stat.key];

          return (
            <Link
              key={stat.key}
              href={stat.href}
              className="group rounded-xl border border-slate-100 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-sm"
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${stat.tone}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-2 text-xs font-medium text-slate-500">{stat.label}</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
                {value.toLocaleString("it-IT")}
              </p>
            </Link>
          );
        })}
      </div>
    </DashboardWidgetShell>
  );
}
