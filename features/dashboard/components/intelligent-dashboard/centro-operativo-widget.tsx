import Link from "next/link";
import { Bot, CalendarDays, MapPin, Phone, Play } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { StatusBadgeModel } from "@/lib/integrations/status";
import type { IntelligentDashboardGreeting } from "../../types/intelligent-dashboard";
import { CentroOperativoWeather } from "./centro-operativo-weather";

const START_DAY_PROMPT = "Inizia la giornata";

function buildJoyHref(prompt?: string): string {
  if (!prompt) return "/joy-ai";
  return `/joy-ai?q=${encodeURIComponent(prompt)}`;
}

const OPERATIVE_ACTIONS = [
  {
    id: "tour",
    label: "Organizza giro",
    icon: MapPin,
    href: buildJoyHref("Organizza il mio giro visite per oggi"),
    tone: "from-amber-500 to-orange-500",
  },
  {
    id: "agenda",
    label: "Agenda",
    icon: CalendarDays,
    href: "/agenda",
    tone: "from-violet-500 to-violet-600",
  },
  {
    id: "follow-up",
    label: "Follow-up",
    icon: Phone,
    href: "/activities?section=followups",
    tone: "from-rose-500 to-rose-600",
  },
  {
    id: "joy",
    label: "Apri Joy",
    icon: Bot,
    href: "/joy-ai",
    tone: "from-indigo-500 to-violet-600",
  },
] as const;

interface CentroOperativoWidgetProps {
  greeting: IntelligentDashboardGreeting;
  crmStatus: StatusBadgeModel;
  calendarStatus: StatusBadgeModel;
  calendarConnectHref?: string | null;
  calendarTooltip?: string | null;
  calendarConnectLabel?: string | null;
  joySummary?: string | null;
}

export function CentroOperativoWidget({
  greeting,
  crmStatus,
  calendarStatus,
  calendarConnectHref,
  calendarTooltip,
  calendarConnectLabel,
  joySummary,
}: CentroOperativoWidgetProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
            Centro Operativo
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            {greeting.salutation}, {greeting.userName}
          </h1>
          <p className="mt-2 capitalize text-sm text-slate-600 sm:text-base">
            {greeting.weekdayLabel} · {greeting.dateLabel}
          </p>
          {joySummary ? (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-medium text-indigo-800">Joy:</span> {joySummary}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={crmStatus.variant}>{crmStatus.label}</Badge>
          <Badge variant={calendarStatus.variant} title={calendarTooltip ?? undefined}>
            {calendarStatus.label}
          </Badge>
          {calendarConnectHref ? (
            <Link
              href={calendarConnectHref}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              {calendarConnectLabel ?? "Collega calendario"}
            </Link>
          ) : null}
        </div>

        <CentroOperativoWeather />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href={buildJoyHref(START_DAY_PROMPT)} className="block w-full sm:w-auto">
            <Button size="lg" className="h-auto min-h-12 w-full gap-2 px-6 text-base sm:w-auto">
              <Play className="h-5 w-5" />
              Inizia la giornata
            </Button>
          </Link>
          <Link href="/joy-ai" className="block w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="h-auto min-h-12 w-full gap-2 px-6 text-base sm:w-auto"
            >
              <Bot className="h-5 w-5" />
              Apri Joy
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {OPERATIVE_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.id}
                href={action.href}
                className={`group flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br ${action.tone} px-3 py-5 text-center text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
              >
                <Icon className="h-6 w-6 opacity-95 transition-transform group-hover:scale-110" />
                <span className="text-sm font-semibold leading-tight sm:text-base">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
