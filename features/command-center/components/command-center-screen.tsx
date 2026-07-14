"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  Bell,
  Brain,
  CalendarDays,
  CheckCircle2,
  CloudSun,
  MapPin,
  Navigation,
  Phone,
  Play,
  Radar,
  Route,
  Sparkles,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PriorityBadge } from "@/features/companies/components/priority-badge";
import { JoyCopilotToast } from "@/features/joy/chat/components/joy-copilot-toast";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import { AGENDA_KIND_LABELS } from "@/lib/constants/agenda";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import { executeCommandCenterAction } from "../actions/command-center-actions";
import type {
  CommandCenterData,
  CommandCenterDecision,
  CommandCenterTimelineItem,
} from "../types/command-center";
import { formatMissionRevenue } from "../utils/build-command-center-mission";
import { CommandCenterMiniMapClient } from "./command-center-mini-map-client";
import {
  JoyAutonomousConfirmDialog,
  type JoyAutonomousPendingExecution,
} from "@/features/joy/autonomous/components/joy-autonomous-confirm-dialog";

const DECISION_ICONS: Record<CommandCenterDecision["icon"], LucideIcon> = {
  visit: CalendarDays,
  follow_up: Bell,
  reminder: Sparkles,
  route: Route,
  agenda: CalendarDays,
  briefing: Sparkles,
  call: Phone,
  navigate: MapPin,
};

function calendarStatusLabel(data: CommandCenterData["calendar"]): string {
  if (!data.configured) {
    return "Google Calendar non configurato";
  }
  if (!data.connected) {
    return "Google Calendar non collegato";
  }
  if (data.needsReconnect) {
    return "Riconnessione richiesta";
  }
  if (data.lastSyncError) {
    return "Sync con errori";
  }
  return data.googleEmail ? `Calendar · ${data.googleEmail}` : "Calendar sincronizzato";
}

function calendarVariant(
  data: CommandCenterData["calendar"]
): "success" | "warning" | "danger" | "muted" {
  if (!data.configured || !data.connected) {
    return "muted";
  }
  if (data.needsReconnect || data.lastSyncError) {
    return "danger";
  }
  return "success";
}

function TimelineRow({ item }: { item: CommandCenterTimelineItem }) {
  const phoneHref = item.phone ? `tel:${item.phone.replace(/\s+/g, "")}` : null;
  const navigateHref =
    item.latitude != null && item.longitude != null
      ? buildGoogleMapsDirectionsUrl(item.latitude, item.longitude)
      : null;
  const briefingHref = `/visits?company=${item.companyId}&briefing=${item.companyId}`;
  const registerHref = item.visitId
    ? companyRegisterVisitHref(item.companyId)
    : `/visits?company=${item.companyId}`;

  return (
    <li className="relative pl-8">
      <span className="absolute left-0 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
        {item.timeLabel}
      </span>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">{item.companyName}</p>
            <p className="text-sm text-slate-600">
              {[item.city, item.distanceLabel].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <Badge variant="info">{item.kind === "visit" ? "Visita" : "Agenda"}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {navigateHref ? (
            <a
              href={navigateHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2 text-xs font-semibold text-sky-900"
            >
              <Navigation className="h-4 w-4" />
              Naviga
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-2 text-xs text-slate-400">
              Naviga
            </span>
          )}
          {phoneHref ? (
            <a
              href={phoneHref}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-900"
            >
              <Phone className="h-4 w-4" />
              Chiama
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-2 text-xs text-slate-400">
              Chiama
            </span>
          )}
          <Link
            href={briefingHref}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-2 text-xs font-semibold text-violet-900"
          >
            <Sparkles className="h-4 w-4" />
            Briefing
          </Link>
          <Link
            href={registerHref}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-2 text-xs font-semibold text-indigo-900"
          >
            <ClipboardCheck className="h-4 w-4" />
            Registra visita
          </Link>
        </div>
      </div>
    </li>
  );
}

interface CommandCenterScreenProps {
  data: CommandCenterData;
}

export function CommandCenterScreen({ data }: CommandCenterScreenProps) {
  const router = useRouter();
  const [pending, setPending] = useState<JoyAutonomousPendingExecution>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const openDecision = useCallback((decision: CommandCenterDecision) => {
    if (decision.operation) {
      setPending({
        title: decision.title,
        description: `${decision.motivation}\n\nImpatto: ${decision.estimatedImpact}\nTempo: ${decision.estimatedTimeLabel}`,
        operation: decision.operation,
        href: decision.href,
      });
      return;
    }
    if (decision.href) {
      router.push(decision.href);
    }
  }, [router]);

  const handleConfirm = () => {
    if (!pending) {
      return;
    }

    startTransition(async () => {
      const result = await executeCommandCenterAction(pending.operation);
      setPending(null);

      if (result.success) {
        setToast({ message: result.message, variant: "success" });
        router.refresh();
        if (result.href ?? pending.href) {
          router.push(result.href ?? pending.href!);
        }
      } else {
        setToast({ message: result.message, variant: "error" });
      }
    });
  };

  return (
    <>
      <div className="space-y-6 pb-8">
        {/* HEADER */}
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900 p-5 text-white shadow-lg sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">
                Eterya One Command Center
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                {data.greeting} {data.userName}
              </h1>
              <p className="mt-2 capitalize text-sm text-indigo-100">{data.dateLabel}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm">
                <CloudSun className="h-5 w-5 text-amber-300" />
                {data.weatherLabel}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={calendarVariant(data.calendar)} className="bg-white/10 text-white">
                  <CalendarDays className="mr-1 h-3.5 w-3.5" />
                  {calendarStatusLabel(data.calendar)}
                </Badge>
                <Badge variant={data.crmSync.variant}>{data.crmSync.label}</Badge>
              </div>
              <Link href="/auto" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-auto min-h-12 w-full gap-2 bg-white text-indigo-900 hover:bg-indigo-50 sm:w-auto"
                >
                  <Play className="h-5 w-5" />
                  Inizia giornata
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {data.error ? (
          <Card>
            <CardContent className="py-4 text-sm text-rose-700">{data.error}</CardContent>
          </Card>
        ) : null}

        {/* MISSIONE DEL GIORNO */}
        <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Missione del giorno</h2>
          <p className="mt-2 text-sm text-slate-700">{data.mission.objective}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Fatturato potenziale", value: formatMissionRevenue(data.mission.potentialRevenue) },
              { label: "Visite consigliate", value: String(data.mission.recommendedVisits) },
              { label: "Km previsti", value: `${data.mission.estimatedKm.toFixed(1)} km` },
              { label: "Tempo stimato", value: data.mission.estimatedTimeLabel },
              { label: "Priorità", value: data.mission.priorityLabel },
              { label: "Radar", value: String(data.radarItems.length) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-center shadow-sm"
              >
                <p className="text-lg font-bold text-slate-900">{item.value}</p>
                <p className="text-[11px] text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          {/* TIMELINE */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
              <Link href="/routes" className="text-sm font-medium text-indigo-600 hover:underline">
                Giro visite
              </Link>
            </div>
            {data.timeline.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-slate-500">
                  Nessuna visita in timeline. Pianifica il giro dalla sezione Joy.
                </CardContent>
              </Card>
            ) : (
              <ol className="space-y-4 border-l-2 border-indigo-100 pl-4">
                {data.timeline.map((item) => (
                  <TimelineRow key={item.id} item={item} />
                ))}
              </ol>
            )}
          </section>

          {/* JOY DECISION CENTER */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Brain className="h-5 w-5 text-violet-600" />
              Joy Decision Center
            </h2>
            {data.decisions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-slate-500">
                  Nessuna decisione urgente al momento.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {data.decisions.slice(0, 6).map((decision) => {
                  const Icon = DECISION_ICONS[decision.icon];
                  return (
                    <Card key={decision.id}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">{decision.title}</p>
                              <Badge variant="info">{decision.impactScore}/100</Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{decision.motivation}</p>
                            <p className="mt-1 text-xs font-medium text-emerald-700">
                              {decision.estimatedImpact}
                            </p>
                            <p className="text-xs text-slate-500">
                              Tempo richiesto: {decision.estimatedTimeLabel}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-10 w-full bg-violet-600 hover:bg-violet-700 sm:w-auto"
                          onClick={() => openDecision(decision)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {decision.actionLabel}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* RADAR */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Radar className="h-5 w-5 text-indigo-600" />
                Radar opportunità
              </h2>
              <Link href="/maps" className="text-sm font-medium text-indigo-600 hover:underline">
                Mappa completa
              </Link>
            </div>
            {data.radarItems.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-slate-500">
                  Nessun hit radar nelle vicinanze.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {data.radarItems.map((item, index) => (
                  <Card key={item.companyId}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-slate-500">#{index + 1}</p>
                          <p className="font-semibold text-slate-900">{item.companyName}</p>
                          <p className="text-xs text-slate-600">
                            {formatDistanceKm(item.distanceKm)} · {item.lastVisitLabel}
                          </p>
                        </div>
                        <PriorityBadge score={item.score} tier={item.tier} />
                      </div>
                      <p className="text-sm text-amber-800">{item.primaryReason}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Link
                          href={`/visits?company=${item.companyId}&briefing=${item.companyId}`}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Briefing
                        </Link>
                        <Link
                          href={`/companies/${item.companyId}`}
                          className="inline-flex min-h-9 items-center text-xs font-medium text-indigo-600 hover:underline"
                        >
                          Apri scheda
                        </Link>
                        <Link
                          href={`/visits?company=${item.companyId}`}
                          className="inline-flex min-h-9 items-center text-xs font-medium text-indigo-600 hover:underline"
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

          {/* MAPPA */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Mappa operativa</h2>
              <Link href="/maps" className="text-sm font-medium text-indigo-600 hover:underline">
                Espandi
              </Link>
            </div>
            <CommandCenterMiniMapClient companies={data.mapCompanies} />
            <p className="text-xs text-slate-500">
              Posizione corrente, clienti prioritari, visite e radar del giorno.
            </p>
          </section>
        </div>

        {/* ATTIVITÀ */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Attività</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Follow-up</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.activities.followUps.length === 0 ? (
                  <p className="text-slate-500">Nessun follow-up scaduto.</p>
                ) : (
                  data.activities.followUps.map((item) => (
                    <p key={item.id} className="text-slate-700">
                      {item.company_name ?? "Azienda"} · {item.priority}
                    </p>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Agenda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.activities.agenda.length === 0 ? (
                  <p className="text-slate-500">Agenda libera.</p>
                ) : (
                  data.activities.agenda.map((item) => (
                    <p key={item.id} className="text-slate-700">
                      {item.title} · {AGENDA_KIND_LABELS[item.kind]}
                    </p>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Promemoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.activities.reminders.length === 0 ? (
                  <p className="text-slate-500">Nessun promemoria.</p>
                ) : (
                  data.activities.reminders.map((item) => (
                    <p key={item.id} className="text-slate-700">
                      {item.title}
                    </p>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Opportunità</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.activities.opportunities.length === 0 ? (
                  <p className="text-slate-500">Nessuna opportunità aperta.</p>
                ) : (
                  data.activities.opportunities.map((item) => (
                    <p key={item.id} className="text-slate-700">
                      {item.company_name ?? item.title} ·{" "}
                      {formatOpportunityAmount(item.total_amount)}
                    </p>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* NOTIFICHE */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Bell className="h-5 w-5 text-rose-500" />
            Notifiche Joy
          </h2>
          {data.notifications.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-slate-500">
                Nessuna notifica critica.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.notifications.map((notification) => (
                <Card key={notification.id}>
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{notification.explanation}</p>
                    </div>
                    {notification.href ? (
                      <Link href={notification.href}>
                        <Button size="sm" variant="outline">
                          Apri
                        </Button>
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <JoyAutonomousConfirmDialog
        open={Boolean(pending)}
        title={pending?.title ?? ""}
        description={pending?.description ?? ""}
        actionLabel="Esegui"
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />

      {toast ? (
        <JoyCopilotToast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </>
  );
}
