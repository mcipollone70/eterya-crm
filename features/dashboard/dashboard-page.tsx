import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  Clock3,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Package,
  Target,
  Timer,
  UserX,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  DASHBOARD_COMMERCIAL_STATUS_LABELS,
  DASHBOARD_COMMERCIAL_STATUSES,
  type DashboardCommercialStatus,
} from "@/lib/constants/commercial-status";
import { getCommercialStatusCounts } from "@/features/companies/services/companies.service";
import { getPriorityDashboardMetrics } from "@/features/companies/services/commercial-priority.service";
import { getVisitDashboardMetrics } from "@/features/visits/services/visits.service";
import {
  getContactHistoryDashboardMetrics,
  listRecentContactHistory,
} from "@/features/activities/services/contact-history.service";
import { getFollowUpDashboardMetrics } from "@/features/activities/services/follow-ups.service";
import { getOpportunityDashboardMetrics } from "@/features/opportunities/services/opportunities.service";
import { getProductDashboardMetrics } from "@/features/products/services/products.service";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { ContactHistoryTimeline } from "@/features/activities/components/contact-history-timeline";
import { cn } from "@/utils/cn";

const KPI_CARD_STYLES: Record<DashboardCommercialStatus, string> = {
  prospect: "border-blue-100 bg-blue-50/50",
  cliente: "border-emerald-100 bg-emerald-50/50",
  ex_cliente: "border-slate-200 bg-slate-50",
  da_ricontattare: "border-amber-100 bg-amber-50/50",
};

const KPI_VALUE_STYLES: Record<DashboardCommercialStatus, string> = {
  prospect: "text-blue-700",
  cliente: "text-emerald-700",
  ex_cliente: "text-slate-700",
  da_ricontattare: "text-amber-700",
};

export async function DashboardPage() {
  const configured = isSupabaseConfigured();

  const [
    countsResult,
    priorityResult,
    visitResult,
    contactResult,
    followUpResult,
    opportunityResult,
    productFamilyResult,
    recentActivitiesResult,
  ] = configured
    ? await Promise.all([
        getCommercialStatusCounts(),
        getPriorityDashboardMetrics(),
        getVisitDashboardMetrics(),
        getContactHistoryDashboardMetrics(),
        getFollowUpDashboardMetrics(),
        getOpportunityDashboardMetrics(),
        getProductDashboardMetrics(),
        listRecentContactHistory(6),
      ])
    : [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const counts = countsResult.data;
  const error = countsResult.error;
  const priorityMetrics = priorityResult.data;
  const priorityError = priorityResult.error;
  const visitMetrics = visitResult.data;
  const visitError = visitResult.error;
  const contactMetrics = contactResult.data;
  const contactError = contactResult.error;
  const followUpMetrics = followUpResult.data;
  const followUpError = followUpResult.error;
  const opportunityMetrics = opportunityResult.data;
  const opportunityError = opportunityResult.error;
  const productFamilyMetrics = productFamilyResult.data;
  const productFamilyError = productFamilyResult.error;
  const recentActivities = recentActivitiesResult.data;

  const hasData =
    configured && counts != null && DASHBOARD_COMMERCIAL_STATUSES.some((key) => counts[key] > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">
          {configured
            ? "Panoramica dello stato commerciale delle aziende."
            : "Benvenuto in Eterya CRM. Inizia importando le tue aziende da Excel."}
        </p>
      </div>

      {!configured && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <LayoutDashboard className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Database non configurato</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Aggiungi le variabili Supabase in .env.local per visualizzare i KPI commerciali.
            </p>
          </CardContent>
        </Card>
      )}

      {configured && (error || priorityError || visitError || contactError || followUpError || opportunityError || productFamilyError) && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-600">
            Impossibile caricare i conteggi:{" "}
            {error ?? priorityError ?? visitError ?? contactError ?? followUpError ?? opportunityError ?? productFamilyError}
          </CardContent>
        </Card>
      )}

      {configured && !error && !priorityError && !visitError && !contactError && !followUpError && !opportunityError && !productFamilyError && (
        <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DASHBOARD_COMMERCIAL_STATUSES.map((status) => (
            <Link
              key={status}
              href={`/companies?commercial_status=${status}`}
              className={cn(
                "rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md",
                KPI_CARD_STYLES[status]
              )}
            >
              <p className="text-sm font-medium text-slate-600">
                {DASHBOARD_COMMERCIAL_STATUS_LABELS[status]}
              </p>
              <p className={cn("mt-2 text-3xl font-bold tabular-nums", KPI_VALUE_STYLES[status])}>
                {(counts?.[status] ?? 0).toLocaleString("it-IT")}
              </p>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/companies?priority_tier=high&sort=priority"
            className="rounded-xl border border-rose-100 bg-rose-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Target className="h-4 w-4 text-rose-600" />
              Priorità alta
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-rose-700">
              {(priorityMetrics?.highPriority ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/companies?commercial_status=da_ricontattare&sort=priority"
            className="rounded-xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Timer className="h-4 w-4 text-amber-600" />
              Da ricontattare oggi
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-amber-700">
              {(priorityMetrics?.contactToday ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/companies?commercial_status=cliente&sort=priority"
            className="rounded-xl border border-orange-100 bg-orange-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <UserX className="h-4 w-4 text-orange-600" />
              Clienti inattivi &gt; 90 gg
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-orange-700">
              {(priorityMetrics?.inactiveClients90Days ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/companies?commercial_status=prospect&sort=priority"
            className="rounded-xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Users className="h-4 w-4 text-blue-600" />
              Prospect mai visitati
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-blue-700">
              {(priorityMetrics?.unvisitedProspects ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/visits"
            className="rounded-xl border border-violet-100 bg-violet-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <CalendarCheck className="h-4 w-4 text-violet-600" />
              Visite oggi
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-violet-700">
              {(visitMetrics?.visitsToday ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/visits"
            className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
              Visite questa settimana
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-indigo-700">
              {(visitMetrics?.visitsThisWeek ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/companies?last_visit=never"
            className="rounded-xl border border-sky-100 bg-sky-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Building2 className="h-4 w-4 text-sky-600" />
              Aziende mai visitate
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-sky-700">
              {(visitMetrics?.neverVisitedCompanies ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/companies?last_visit=over_90&commercial_status=cliente"
            className="rounded-xl border border-orange-100 bg-orange-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <UserX className="h-4 w-4 text-orange-600" />
              Clienti senza visita &gt; 90 gg
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-orange-700">
              {(visitMetrics?.clientsWithoutVisit90Days ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/activities?period=today"
            className="rounded-xl border border-teal-100 bg-teal-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <History className="h-4 w-4 text-teal-600" />
              Attività di oggi
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-teal-700">
              {(contactMetrics?.activitiesToday ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/activities"
            className="rounded-xl border border-rose-100 bg-rose-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Clock3 className="h-4 w-4 text-rose-600" />
              Attività in ritardo
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-rose-700">
              {(contactMetrics?.overdueActivities ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/activities?period=week"
            className="rounded-xl border border-cyan-100 bg-cyan-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <History className="h-4 w-4 text-cyan-600" />
              Attività questa settimana
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-cyan-700">
              {(contactMetrics?.activitiesThisWeek ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/activities"
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <History className="h-4 w-4 text-slate-600" />
              Ultime attività
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-700">
              {recentActivities.length.toLocaleString("it-IT")}
            </p>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/activities?section=followups&fperiod=today"
            className="rounded-xl border border-cyan-100 bg-cyan-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Timer className="h-4 w-4 text-cyan-600" />
              Follow-up di oggi
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-cyan-700">
              {(followUpMetrics?.today ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/activities?section=followups&fperiod=overdue"
            className="rounded-xl border border-rose-100 bg-rose-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Clock3 className="h-4 w-4 text-rose-600" />
              Follow-up scaduti
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-rose-700">
              {(followUpMetrics?.overdue ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/activities?section=followups&fperiod=next7"
            className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
              Follow-up prossimi 7 gg
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-indigo-700">
              {(followUpMetrics?.next7Days ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/activities?section=followups&fpriority=high"
            className="rounded-xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Target className="h-4 w-4 text-amber-600" />
              Follow-up alta priorità
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-amber-700">
              {(followUpMetrics?.highPriority ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/opportunities"
            className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Target className="h-4 w-4 text-indigo-600" />
              Opportunità aperte
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-indigo-700">
              {(opportunityMetrics?.openCount ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/opportunities"
            className="rounded-xl border border-violet-100 bg-violet-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Target className="h-4 w-4 text-violet-600" />
              Valore pipeline
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-violet-700">
              {formatOpportunityAmount(opportunityMetrics?.pipelineValue ?? 0)}
            </p>
          </Link>

          <Link
            href="/opportunities"
            className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Target className="h-4 w-4 text-emerald-600" />
              Opportunità vinte
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-700">
              {(opportunityMetrics?.wonCount ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>

          <Link
            href="/opportunities"
            className="rounded-xl border border-rose-100 bg-rose-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Target className="h-4 w-4 text-rose-600" />
              Opportunità perse
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-rose-700">
              {(opportunityMetrics?.lostCount ?? 0).toLocaleString("it-IT")}
            </p>
          </Link>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Prodotti e pipeline per famiglia</h3>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {productFamilyMetrics.map((metric) => (
              <Link
                key={metric.family}
                href={`/companies?product_family=${metric.family}`}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Package className="h-4 w-4 text-indigo-600" />
                  {metric.label}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Aziende</p>
                    <p className="text-lg font-bold text-slate-900">{metric.interestedCompanies}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Opportunità</p>
                    <p className="text-lg font-bold text-slate-900">{metric.openOpportunities}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Pipeline</p>
                    <p className="text-sm font-bold text-slate-900">
                      {formatOpportunityAmount(metric.pipelineValue)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {recentActivities.length > 0 && (
          <ContactHistoryTimeline items={recentActivities} title="Ultime attività" />
        )}
        </>
      )}

      {configured && !error && !priorityError && !visitError && !contactError && !followUpError && !opportunityError && !productFamilyError && !hasData && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Building2 className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Nessun dato disponibile</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Il CRM è pronto. Importa il tuo elenco aziende da un file Excel per iniziare a
              lavorare con dati reali.
            </p>
            <Link
              href="/companies/import"
              className={cn(
                "mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
              )}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importa Aziende
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
