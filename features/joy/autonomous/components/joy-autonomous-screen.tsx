"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  AlertTriangle,
  Bell,
  Brain,
  CalendarDays,
  CheckCircle2,
  Focus,
  LayoutDashboard,
  Loader2,
  MapPin,
  Route,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { JoyCopilotToast } from "../../chat/components/joy-copilot-toast";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { executeJoyAutonomousAction } from "../actions/joy-autonomous-actions";
import type {
  JoyAutonomousData,
  JoyAutonomousDecision,
  JoyAutonomousNotification,
  JoyAutonomousTab,
} from "../types/joy-autonomous";
import {
  JoyAutonomousConfirmDialog,
  type JoyAutonomousPendingExecution,
} from "./joy-autonomous-confirm-dialog";

const TAB_ITEMS: Array<{ id: JoyAutonomousTab; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "notifications", label: "Notifiche", icon: Bell },
  { id: "decisions", label: "Decisioni", icon: Brain },
  { id: "focus", label: "Focus", icon: Focus },
];

const DECISION_ICONS: Record<JoyAutonomousDecision["icon"], LucideIcon> = {
  visit: CalendarDays,
  follow_up: Bell,
  reminder: Sparkles,
  route: Route,
  agenda: CalendarDays,
  briefing: Sparkles,
  call: Target,
  navigate: MapPin,
};

function severityVariant(severity: JoyAutonomousNotification["severity"]) {
  if (severity === "high") {
    return "danger" as const;
  }
  if (severity === "medium") {
    return "warning" as const;
  }
  return "muted" as const;
}

interface JoyAutonomousScreenProps {
  data: JoyAutonomousData;
}

export function JoyAutonomousScreen({ data }: JoyAutonomousScreenProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<JoyAutonomousTab>("dashboard");
  const [pending, setPending] = useState<JoyAutonomousPendingExecution>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const openExecution = useCallback((decision: JoyAutonomousDecision) => {
    if (decision.operation) {
      setPending({
        title: decision.title,
        description: `${decision.motivation}\n\nImpatto: ${decision.estimatedImpact}`,
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
      const result = await executeJoyAutonomousAction(pending.operation);
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
      <div className="space-y-4 pb-6">
        <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                Joy AI Autonomous
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                Ciao {data.userName}
              </h2>
              <p className="mt-1 capitalize text-sm text-slate-600">{data.dateLabel}</p>
              <p className="mt-2 text-sm text-violet-900">{data.briefing.narrative}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[
                { label: "Visite", value: data.summary.visitsToday },
                { label: "Follow-up", value: data.summary.overdueFollowUps },
                { label: "Radar", value: data.summary.radarHits },
                { label: "Pipeline", value: formatOpportunityAmount(data.summary.pipelineValue) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm"
                >
                  <p className="text-lg font-bold text-slate-900">{item.value}</p>
                  <p className="text-[11px] text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            const count =
              tab.id === "notifications"
                ? data.notifications.length
                : tab.id === "decisions"
                  ? data.decisions.length
                  : tab.id === "focus"
                    ? data.focusQueue.length
                    : 0;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "border-violet-300 bg-violet-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {count > 0 ? (
                  <span
                    className={`rounded-full px-1.5 text-xs ${
                      activeTab === tab.id ? "bg-white/20" : "bg-slate-100"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {activeTab === "dashboard" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Briefing della giornata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <p>{data.briefing.headline}</p>
                <div>
                  <p className="font-semibold text-slate-900">Clienti prioritari</p>
                  <ul className="mt-2 space-y-1">
                    {data.briefing.priorityClients.slice(0, 5).map((client) => (
                      <li key={client.companyId}>
                        <Link
                          href={`/joy/autonomous?focus=${client.companyId}`}
                          className="text-violet-700 hover:underline"
                        >
                          {client.companyName}
                        </Link>
                        <span className="text-slate-500"> · {client.reasons[0]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Percorso consigliato</p>
                  <p className="mt-1">
                    {data.briefing.recommendedRoute.stops} tappe ·{" "}
                    {data.briefing.recommendedRoute.estimatedKm.toFixed(1)} km
                  </p>
                  <Link href={data.briefing.recommendedRoute.href} className="mt-2 inline-block">
                    <Button size="sm" variant="outline">
                      Apri giro visite
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agenda e radar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">Agenda di oggi</p>
                  {data.briefing.agendaItems.length === 0 ? (
                    <p className="mt-1 text-slate-500">Nessun impegno aperto.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-slate-700">
                      {data.briefing.agendaItems.map((item) => (
                        <li key={item.id}>
                          {item.title} · {new Date(item.scheduledAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Radar opportunità</p>
                  {data.briefing.radarItems.length === 0 ? (
                    <p className="mt-1 text-slate-500">Nessun hit radar nelle vicinanze.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-slate-700">
                      {data.briefing.radarItems.map((item) => (
                        <li key={item.companyId}>
                          {item.companyName} · {item.primaryReason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Rischio clienti persi
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.briefing.lostClientRisks.length === 0 ? (
                  <p className="text-sm text-slate-500">Nessun rischio critico rilevato oggi.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.briefing.lostClientRisks.map((risk) => (
                      <li
                        key={risk.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{risk.title}</p>
                          <p className="text-xs text-slate-600">{risk.explanation}</p>
                        </div>
                        <Link href={risk.href}>
                          <Button size="sm" variant="outline">
                            Apri
                          </Button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "notifications" ? (
          <div className="space-y-3">
            {data.notifications.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-slate-500">
                  Nessuna notifica intelligente al momento.
                </CardContent>
              </Card>
            ) : (
              data.notifications.map((notification) => (
                <Card key={notification.id}>
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={severityVariant(notification.severity)}>
                          {notification.kind.replace(/_/g, " ")}
                        </Badge>
                        <p className="font-medium text-slate-900">{notification.title}</p>
                      </div>
                      <p className="text-sm text-slate-600">{notification.explanation}</p>
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
              ))
            )}
          </div>
        ) : null}

        {activeTab === "decisions" ? (
          <div className="space-y-3">
            {data.decisions.map((decision) => {
              const Icon = DECISION_ICONS[decision.icon];
              return (
                <Card key={decision.id}>
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{decision.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{decision.motivation}</p>
                        <p className="mt-2 text-xs font-medium text-emerald-700">
                          Impatto: {decision.estimatedImpact}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 bg-violet-600 hover:bg-violet-700"
                      onClick={() => openExecution(decision)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {decision.actionLabel}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        {activeTab === "focus" ? (
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Modalità Focus</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Un cliente alla volta: briefing, cronologia, prodotti, opportunità, note vocali e
                azioni rapide.
              </CardContent>
            </Card>
            {data.focusQueue.map((item, index) => (
              <Card key={item.companyId}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-violet-700">
                      Focus {index + 1}
                    </p>
                    <p className="font-semibold text-slate-900">{item.companyName}</p>
                    <p className="text-sm text-slate-600">
                      {item.city ? `${item.city} · ` : ""}
                      {item.reason}
                    </p>
                  </div>
                  <Link href={item.href}>
                    <Button size="sm">Entra in Focus</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
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
