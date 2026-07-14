import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CloudSun,
  Clock3,
  FileText,
  MapPin,
  Navigation,
  Phone,
  Radar,
  Route,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PriorityBadge } from "@/features/companies/components/priority-badge";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import { AGENDA_KIND_LABELS } from "@/lib/constants/agenda";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import { formatVisitDateShort } from "@/lib/last-visit/format";
import type {
  MissionControlAction,
  MissionControlData,
  MissionActionIcon,
} from "../types/mission-control";

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

function calendarStatusVariant(data: MissionControlData["calendar"]): "success" | "warning" | "danger" | "muted" {
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
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">{action.title}</p>
        <p className="mt-1 text-sm text-slate-600">{action.explanation}</p>
        <Link href={action.href} className="mt-3 inline-block">
          <Button size="sm">{action.actionLabel}</Button>
        </Link>
      </div>
    </div>
  );
}

interface MissionControlDashboardProps {
  data: MissionControlData;
}

export function MissionControlDashboard({ data }: MissionControlDashboardProps) {
  const phoneHref = data.nextVisit?.phone
    ? `tel:${data.nextVisit.phone.replace(/\s+/g, "")}`
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-700">Mission Control</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Buongiorno {data.userName}
            </h1>
            <p className="mt-2 capitalize text-sm text-slate-600">{data.dateLabel}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <CloudSun className="h-4 w-4 text-amber-500" />
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
          </div>
        </div>
      </section>

      {data.error ? (
        <Card>
          <CardContent className="py-6 text-sm text-rose-700">{data.error}</CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {[
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
            label: "Opportunità aperte",
            value: data.kpis.openOpportunities.toLocaleString("it-IT"),
            icon: Target,
            href: "/opportunities",
            tone: "text-indigo-700 bg-indigo-50 border-indigo-100",
          },
          {
            label: "Prospect da visitare",
            value: data.kpis.prospectsToVisit.toLocaleString("it-IT"),
            icon: Users,
            href: "/companies?commercial_status=prospect&sort=priority",
            tone: "text-blue-700 bg-blue-50 border-blue-100",
          },
          {
            label: "Km stimati del giro",
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
            tone: "text-violet-700 bg-violet-50 border-violet-100",
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className={`rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${kpi.tone}`}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Icon className="h-4 w-4" />
                {kpi.label}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{kpi.value}</p>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Cosa fare adesso</h2>
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{data.nextVisit.companyName}</CardTitle>
                <p className="text-sm text-slate-500">
                  Oggi alle {data.nextVisit.scheduledLabel}
                  {data.nextVisit.distanceKm != null
                    ? ` · ${formatDistanceKm(data.nextVisit.distanceKm)}`
                    : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid gap-2 text-sm text-slate-700">
                  <p>
                    <span className="text-slate-500">Telefono: </span>
                    {data.nextVisit.phone ?? "—"}
                  </p>
                  <p>
                    <span className="text-slate-500">Note: </span>
                    {data.nextVisit.notes?.trim() || "Nessuna nota"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.nextVisit.latitude != null && data.nextVisit.longitude != null ? (
                    <a
                      href={buildGoogleMapsDirectionsUrl(
                        data.nextVisit.latitude,
                        data.nextVisit.longitude
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Naviga
                    </a>
                  ) : null}
                  {phoneHref ? (
                    <a
                      href={phoneHref}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Chiama
                    </a>
                  ) : null}
                  <Link
                    href={`/assistant?briefing=${data.nextVisit.companyId}`}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Briefing
                  </Link>
                  <Link
                    href={companyRegisterVisitHref(data.nextVisit.companyId)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Registra visita
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-slate-500">
                Nessuna visita pianificata per oggi.
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
            <h2 className="text-lg font-semibold text-slate-900">Agenda di oggi</h2>
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
                        href={`/companies/${item.companyId}`}
                        className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Apri
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
