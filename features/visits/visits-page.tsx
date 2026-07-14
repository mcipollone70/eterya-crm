import { Suspense } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { EmptyState, PageHeader, PageLoadingSkeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isVisitPeriod, VISIT_PERIOD_OPTIONS } from "@/lib/constants/visit-workflow";
import { CompanyBriefingLoader } from "@/features/assistant/components/company-briefing-loader";
import { VisitPeriodTabs } from "./components/visit-period-tabs";
import { VisitFieldLinks } from "./components/visit-field-links";
import { ScheduleVisitForm } from "./components/schedule-visit-form";
import { VisitsList } from "./components/visits-list";
import { VisitsMetricsBar } from "./components/visits-metrics-bar";
import {
  getVisitDashboardMetrics,
  listVisitCompanyOptions,
  listVisits,
} from "./services/visits.service";

interface VisitsPageProps {
  period?: string;
  company?: string;
  briefing?: string;
}

function periodLabel(period: string): string {
  return VISIT_PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "Oggi";
}

export async function VisitsPage({ period, company, briefing }: VisitsPageProps) {
  const activePeriod = isVisitPeriod(period) ? period : "today";
  const briefingCompanyId = briefing?.trim() || company?.trim() || "";

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4 sm:space-y-6">
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
    listVisitCompanyOptions(company || undefined),
    getVisitDashboardMetrics(),
  ]);

  const periodTitle = periodLabel(activePeriod);
  const filteredCompany = company
    ? companies.find((item) => item.id === company)
    : null;

  return (
    <div className="space-y-4 sm:space-y-6">
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
        <VisitsMetricsBar
          visitsToday={metrics.visitsToday}
          visitsThisWeek={metrics.visitsThisWeek}
          neverVisitedCompanies={metrics.neverVisitedCompanies}
          clientsWithoutVisit90Days={metrics.clientsWithoutVisit90Days}
        />
      )}

      <div className="flex flex-col gap-4">
        <Suspense fallback={<PageLoadingSkeleton rows={1} />}>
          <VisitPeriodTabs />
        </Suspense>
      </div>

      {briefingCompanyId ? (
        <CompanyBriefingLoader
          companyId={briefingCompanyId}
          backHref="/visits"
          backLabel="Torna alle visite"
        />
      ) : null}

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

      <ScheduleVisitForm companies={companies} defaultCompanyId={company} fixedOnMobile />
    </div>
  );
}
