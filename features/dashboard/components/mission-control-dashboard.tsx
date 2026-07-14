import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CloudSun,
  Clock3,
  Flame,
  MapPin,
  Phone,
  Play,
  Radar,
  Route,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PriorityBadge } from "@/features/companies/components/priority-badge";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import { AGENDA_KIND_LABELS } from "@/lib/constants/agenda";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import type {
  MissionControlAction,
  MissionControlData,
  MissionActionIcon,
} from "../types/mission-control";
import { MissionControlNextVisitCard } from "./mission-control-next-visit-card";

const ACTION_ICONS: Record<MissionActionIcon, LucideIcon> = {
  phone: Phone,
  calendar: CalendarDays,
  check: CheckCircle2,
  "map-pin": MapPin,
  route: Route,
  target: Target,
};

function calendarStatusLabel(data: MissionControlData["calendar"]): string {
  if (!data.configured) {
    return "Google Calendar non configurato";
  }
  if (!data.connected) {
    return "Google Calendar non collegato";
  }
  if (data.needsReconnect) {
    return "Riconnessione Google Calendar richiesta";
  }
  if (data.lastSyncError) {
    return "Sincronizzazione con errori";
  }
  return data.googleEmail ? `Sincronizzato · ${data.googleEmail}` : "Google Calendar sincronizzato";
}

function calendarStatusVariant(
  data: MissionControlData["calendar"]
): "success" | "warning" | "danger" | "muted" {
  if (!data.configured || !data.connected) {
    return "muted";
  }
  if (data.needsReconnect || data.lastSyncError) {
    return "danger";
  }
  return "success";
}

function MissionActionRow({ action }: { action: MissionControlAction }) {
  const Icon = ACTION_ICONS[action.icon];

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{action.title}</p>
        <p className="mt-1 text-sm text-slate-600">{action.explanation}</p>
        <Link href={action.href} className="mt-3 inline-block">
          <Button size="sm" className="min-h-10">
            {action.actionLabel}
          </Button>
        </Link>
      </div>
    </div>
  );
}

interface MissionControlDashboardProps {
  data: MissionControlData;
}

export function MissionControlDashboard({ data }: MissionControlDashboardProps) {
  const todayKpis = [
    {
      label: "Visite oggi",
      value: data.kpis.visitsToday.toLocaleString("it-IT"),
      icon: CalendarCheck,
      href: "/visits",
      tone: "text-violet-700 bg-violet-50 border-violet-100",
    },
    {
      label: "Follow-up scaduti",
      value: data.kpis.overdueFollowUps.toLocaleString("it-IT"),
      icon: Clock3,
      href: "/activities?section=followups&fperiod=overdue",
      tone: "text-rose-700 bg-rose-50 border-rose-100",
    },
    {
      label: "Opportunità calde",
      value: data.kpis.hotOpportunities.toLocaleString("it-IT"),
      icon: Flame,
      href: "/opportunities",
      tone: "text-orange-700 bg-orange-50 border-orange-100",
    },
    {
      label: "Prospect da visitare",
      value: data.kpis.prospectsToVisit.toLocaleString("it-IT"),
      icon: Users,
      href: "/companies?commercial_status=prospect&sort=priority",
      tone: "text-blue-700 bg-blue-50 border-blue-100",
    },
    {
      label: "Km previsti",
      value: `${data.kpis.estimatedTourKm.toLocaleString("it-IT", { maximumFractionDigits: 1 })} km`,
      icon: Route,
      href: "/routes",
      tone: "text-emerald-700 bg-emerald-50 border-emerald-100",
    },
    {
      label: "Valore pipeline",
      value: formatOpportunityAmount(data.kpis.pipelineValue),
      icon: Target,
      href: "/opportunities",
      tone: "text-indigo-700 bg-indigo-50 border-indigo-100",
    },
  ];

  return (
    <div className="space-y-6 pb-2">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
              Mission Control
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Buongiorno {data.userName}
            </h1>
            <p className="mt-2 capitalize text-sm text-slate-600 sm:text-base">{data.dateLabel}</p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">
              <CloudSun className="h-5 w-5 text-amber-500" />
              {data.weatherLabel}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={calendarStatusVariant(data.calendar)}>
                <CalendarDays className="mr-1 h-3.5 w-3.5" />
                {calendarStatusLabel(data.calendar)}
              </Badge>
              {!data.calendar.connected && data.calendar.configured ? (
                <Link href="/settings" className="text-xs font-medium text-indigo-600 hover:underline">
                  Collega calendario
                </Link>
              ) : null}
            </div>
            <Link href="/auto" className="w-full sm:w-auto">
              <Button size="lg" className="h-auto min-h-11 w-full gap-2 sm:w-auto">
                <Play className="h-4 w-4" />
                Inizia giornata
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {data.error ? (
        <Card>
          <CardContent className="py-6 text-sm text-rose-700">{data.error}</CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Oggi</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {todayKpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Link
                key={kpi.label}
                href={kpi.href}
                className={`rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${kpi.tone}`}
              >
                <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Icon className="h-4 w-4 shrink-0" />
                  {kpi.label}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{kpi.value}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Cosa faccio adesso</h2>
            <Link href="/assistant" className="text-sm font-medium text-indigo-600 hover:underline">
              Assistente
            </Link>
          </div>
          {data.actions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-slate-500">
                Nessun suggerimento urgente. Ottimo lavoro!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.actions.map((action) => (
                <MissionActionRow key={action.id} action={action} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Prossima visita</h2>
          {data.nextVisit ? (
            <MissionControlNextVisitCard nextVisit={data.nextVisit} />
          ) : (
            <Card>
              <CardContent className="space-y-3 py-8 text-center text-sm text-slate-500">
                <p>Nessuna visita pianificata per oggi.</p>
                <Link href="/visits">
                  <Button size="sm" variant="outline">
                    Apri visite
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Radar className="h-5 w-5 text-indigo-600" />
              Radar
            </h2>
            <Link href="/maps" className="text-sm font-medium text-indigo-600 hover:underline">
              Apri mappa
            </Link>
          </div>
          {data.radarItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-slate-500">
                Nessun suggerimento radar disponibile.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.radarItems.map((item, index) => (
                <Card key={item.companyId}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500">#{index + 1}</p>
                        <p className="font-semibold text-slate-900">{item.companyName}</p>
                        <p className="text-xs text-slate-600">
                          {formatDistanceKm(item.distanceKm)} · {item.lastVisitLabel}
                        </p>
                      </div>
                      <PriorityBadge score={item.score} tier={item.tier} />
                    </div>
                    <p className="text-sm text-amber-800">🔥 {item.primaryReason}</p>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/visits?company=${item.companyId}&briefing=${item.companyId}`}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Briefing
                      </Link>
                      <Link
                        href={`/companies/${item.companyId}`}
                        className="text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Apri scheda
                      </Link>
                      <Link
                        href={`/visits?company=${item.companyId}`}
                        className="text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Pianifica visita
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Agenda</h2>
            <Link href="/agenda" className="text-sm font-medium text-indigo-600 hover:underline">
              Vedi agenda
            </Link>
          </div>
          {data.agendaItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-slate-500">
                Nessun appuntamento in programma per oggi.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.agendaItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="muted">{AGENDA_KIND_LABELS[item.kind]}</Badge>
                        <span className="text-xs text-slate-500">
                          {new Date(item.scheduledAt).toLocaleTimeString("it-IT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-600">
                        {item.companyName ?? item.contactName ?? "—"}
                      </p>
                      {item.notes ? (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.notes}</p>
                      ) : null}
                    </div>
                    {item.companyId ? (
                      <Link
                        href={
                          item.kind === "visit"
                            ? `/visits?company=${item.companyId}&briefing=${item.companyId}`
                            : `/companies/${item.companyId}`
                        }
                        className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
                      >
                        {item.kind === "visit" ? "Briefing" : "Apri"}
                      </Link>
                    ) : (
                      <Link
                        href="/agenda"
                        className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Agenda
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
