import { Suspense } from "react";
import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  isContactHistoryPeriod,
  isContactHistoryType,
} from "@/lib/constants/contact-history";
import {
  isActivitiesSection,
  isFollowUpPeriod,
  isFollowUpPriority,
  isFollowUpStatus,
  isFollowUpView,
} from "@/lib/constants/follow-up";
import { ActivitiesSectionTabs } from "./components/activities-section-tabs";
import { JoyAiPageLink } from "@/features/joy/components/joy-ai-page-link";
import { ContactHistoryFilters } from "./components/contact-history-filters";
import { ContactHistoryTimeline } from "./components/contact-history-timeline";
import { FollowUpCalendar } from "./components/follow-up-calendar";
import { FollowUpFilters } from "./components/follow-up-filters";
import { FollowUpList } from "./components/follow-up-list";
import {
  listContactHistory,
  listContactHistoryOperators,
} from "./services/contact-history.service";
import { listFollowUps } from "./services/follow-ups.service";

interface ActivitiesPageProps {
  section?: string;
  view?: string;
  type?: string;
  period?: string;
  operator?: string;
  search?: string;
  fstatus?: string;
  fpriority?: string;
  fperiod?: string;
  fcompany?: string;
}

export async function ActivitiesPage({
  section,
  view,
  type,
  period,
  operator,
  search,
  fstatus,
  fpriority,
  fperiod,
  fcompany,
}: ActivitiesPageProps) {
  const activeSection = isActivitiesSection(section) ? section : "history";
  const followUpView = isFollowUpView(view) ? view : "list";

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Attività" subtitle="Storico contatti e follow-up." />
        <EmptyState
          icon={CheckSquare}
          title="Database non configurato"
          message="Configura Supabase in .env.local per consultare attività e follow-up."
        />
      </div>
    );
  }

  if (activeSection === "followups") {
    const { data: followUps, error } = await listFollowUps({
      companyId: fcompany || undefined,
      status: isFollowUpStatus(fstatus) ? fstatus : null,
      priority: isFollowUpPriority(fpriority) ? fpriority : null,
      period: isFollowUpPeriod(fperiod) && fperiod ? fperiod : null,
      limit: 500,
    });

    return (
      <div className="space-y-6">
        <PageHeader
          title="Attività"
          subtitle={`${followUps.length.toLocaleString("it-IT")} follow-up${
            followUpView === "calendar" ? " · vista calendario" : " · vista elenco"
          }.`}
          actions={<JoyAiPageLink prompt="Quali follow-up sono in ritardo?" />}
        />

        <Suspense fallback={null}>
          <ActivitiesSectionTabs />
        </Suspense>

        <Suspense fallback={null}>
          <FollowUpFilters />
        </Suspense>

        {error ? (
          <EmptyState icon={CheckSquare} title="Impossibile caricare i follow-up" message={error} />
        ) : followUps.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="Nessun follow-up"
            message="Crea promemoria dalla scheda azienda o con il pulsante Nuovo follow-up."
            action={
              <Link
                href="/companies"
                className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Vai alle aziende
              </Link>
            }
          />
        ) : followUpView === "calendar" ? (
          <FollowUpCalendar items={followUps} />
        ) : (
          <FollowUpList items={followUps} />
        )}
      </div>
    );
  }

  const [{ data: items, error }, { data: operators }] = await Promise.all([
    listContactHistory({
      type: isContactHistoryType(type) ? type : null,
      period: isContactHistoryPeriod(period) && period ? period : null,
      operatorId: operator || null,
      search: search || null,
      limit: 300,
    }),
    listContactHistoryOperators(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attività"
        subtitle={`${items.length.toLocaleString("it-IT")} voci nello storico contatti${
          search ? " · ricerca attiva" : ""
        }.`}
        actions={<JoyAiPageLink prompt="Riepiloga la mia giornata" />}
      />

      <Suspense fallback={null}>
        <ActivitiesSectionTabs />
      </Suspense>

      <Suspense fallback={null}>
        <ContactHistoryFilters operators={operators} />
      </Suspense>

      {error ? (
        <EmptyState icon={CheckSquare} title="Impossibile caricare lo storico" message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nessuna attività"
          message="Registra telefonate, WhatsApp, email, visite o note dalla scheda azienda."
          action={
            <Link
              href="/companies"
              className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Vai alle aziende
            </Link>
          }
        />
      ) : (
        <ContactHistoryTimeline items={items} />
      )}
    </div>
  );
}
