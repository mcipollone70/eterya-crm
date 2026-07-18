import Link from "next/link";
import {
  Bot,
  Building2,
  CalendarPlus,
  FileSpreadsheet,
  MapPin,
  Route,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const QUICK_ACTIONS: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    label: "Nuova Azienda",
    href: "/companies/new",
    icon: Building2,
    tone: "from-indigo-500 to-indigo-600",
  },
  {
    label: "Importa Excel",
    href: "/companies/import",
    icon: FileSpreadsheet,
    tone: "from-emerald-500 to-emerald-600",
  },
  {
    label: "Nuovo Appuntamento",
    href: "/agenda?create=1",
    icon: CalendarPlus,
    tone: "from-violet-500 to-violet-600",
  },
  {
    label: "Nuova Visita",
    href: "/visits?create=1",
    icon: MapPin,
    tone: "from-blue-500 to-blue-600",
  },
  {
    label: "Giro Visite",
    href: "/giro-visite",
    icon: Route,
    tone: "from-amber-500 to-orange-500",
  },
  {
    label: "Joy AI",
    href: "/joy-ai",
    icon: Bot,
    tone: "from-fuchsia-500 to-violet-600",
  },
];

export function QuickActionsWidget() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <Zap className="h-4 w-4" />
        </span>
        <h2 className="text-base font-semibold text-slate-900">Azioni rapide</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`group flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br ${action.tone} px-3 py-4 text-center text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
            >
              <Icon className="h-5 w-5 opacity-90 transition-transform group-hover:scale-110" />
              <span className="text-xs font-semibold leading-tight sm:text-sm">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
