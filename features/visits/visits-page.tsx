import { Suspense } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isVisitPeriod, VISIT_PERIOD_OPTIONS } from "@/lib/constants/visit-workflow";
import { VisitPeriodTabs } from "./components/visit-period-tabs";
import { VisitFieldLinks } from "./components/visit-field-links";
import { ScheduleVisitForm } from "./components/schedule-visit-form";
import { VisitsList } from "./components/visits-list";
import {
  getVisitDashboardMetrics,
  listVisitCompanyOptions,
  listVisits,
} from "./services/visits.service";

interface VisitsPageProps {
  period?: string;
  company?: string;
}

function periodLabel(period: string): string {
  return VISIT_PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "Oggi";
}

export async function VisitsPage({ period, company }: VisitsPageProps) {
  const activePeriod = isVisitPeriod(period) ? period : "today";

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Visite" subtitle="Agenda operativa sul campo." />
        <EmptyState
          icon={MapPin}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire le visite."
        />
      </div>
    );
  }

  const [{ data: visits, error }, { data: companies }, { data: metrics }] = await Promise.all([
    listVisits({
      period: activePeriod,
      companyId: company || undefined,
      limit: 200,
    }),
    listVisitCompanyOptions(),
    getVisitDashboardMetrics(),
  ]);

  const periodTitle = periodLabel(activePeriod);
  const filteredCompany = company
    ? companies.find((item) => item.id === company)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visite"
        subtitle={
          filteredCompany
            ? `${periodTitle} · ${filteredCompany.name}`
            : `${periodTitle} · agenda operativa sul campo`
        }
        actions={<VisitFieldLinks />}
      />

      {metrics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Completate oggi
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.visitsToday}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Settimana
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.visitsThisWeek}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Mai visitate
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {metrics.neverVisitedCompanies}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Clienti &gt; 90 gg
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {metrics.clientsWithoutVisit90Days}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Suspense fallback={null}>
          <VisitPeriodTabs />
        </Suspense>
        <ScheduleVisitForm companies={companies} defaultCompanyId={company} />
      </div>

      {company && filteredCompany && (
        <p className="text-sm text-slate-600">
          Filtro azienda attivo:{" "}
          <Link href="/visits" className="font-medium text-indigo-600 hover:underline">
            mostra tutte
          </Link>
        </p>
      )}

      {error ? (
        <EmptyState icon={MapPin} title="Impossibile caricare le visite" message={error} />
      ) : (
        <VisitsList
          visits={visits}
          emptyMessage={
            activePeriod === "today"
              ? "Nessuna visita per oggi. Pianifica una visita o usa il Giro Visite."
              : `Nessuna visita per il filtro "${periodTitle}".`
          }
        />
      )}
    </div>
  );
}
