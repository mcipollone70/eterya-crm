import Link from "next/link";
import { Suspense } from "react";
import { Pencil } from "lucide-react";
import { Button, DeleteButton, PageHeader } from "@/components/ui";
import { deleteCompanyAction } from "../actions/company-mutations";
import {
  DEFAULT_COMPANY_DETAIL_TAB,
  isCompanyDetailTab,
  type CompanyDetailTabId,
} from "../constants/company-detail-tabs";
import { getCompanyPriorityInfo } from "../services/company-detail.service";
import type { Company } from "../services/companies.service";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import { CompanyMobileActionBar } from "./company-mobile-action-bar";
import { CompanyDetailSummary } from "./company-detail-summary";
import { CompanyDetailTabs } from "./company-detail-tabs";
import { CompanyDetailOverviewTab } from "./company-detail-overview-tab";
import { CompanyDetailActivitiesTab } from "./company-detail-activities-tab";
import { CompanyDetailVisitsTab } from "./company-detail-visits-tab";
import { CompanyDetailProductsTab } from "./company-detail-products-tab";
import { CompanyDetailDocumentsTab } from "./company-detail-documents-tab";
import { CompanyDetailMapTab } from "./company-detail-map-tab";
import { CompanyDetailNotesTab } from "./company-detail-notes-tab";
import { CompanyDetailCommercialTab } from "./company-detail-commercial-tab";
import { CompanyDetailStatisticsTab } from "./company-detail-statistics-tab";

interface CompanyDetailProps {
  company: Company;
  contacts: ContactListItem[];
  activeTab?: string;
  historyPeriod?: string;
  registerVisit?: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function CompanyDetailTabContent({
  company,
  contacts,
  activeTab,
  historyPeriod,
}: {
  company: Company;
  contacts: ContactListItem[];
  activeTab: CompanyDetailTabId;
  historyPeriod?: string;
}) {
  switch (activeTab) {
    case "attivita":
      return (
        <CompanyDetailActivitiesTab companyId={company.id} period={historyPeriod} />
      );
    case "visite":
      return <CompanyDetailVisitsTab companyId={company.id} />;
    case "commerciale":
      return <CompanyDetailCommercialTab companyId={company.id} contacts={contacts} />;
    case "prodotti":
      return <CompanyDetailProductsTab companyId={company.id} />;
    case "documenti":
      return <CompanyDetailDocumentsTab companyId={company.id} />;
    case "mappa":
      return <CompanyDetailMapTab company={company} />;
    case "note":
      return (
        <CompanyDetailNotesTab
          companyId={company.id}
          notes={company.notes}
          internalNotes={company.internal_notes}
          updatedAt={company.updated_at}
        />
      );
    case "statistiche":
      return <CompanyDetailStatisticsTab companyId={company.id} />;
    case "panoramica":
    default:
      return <CompanyDetailOverviewTab company={company} contacts={contacts} />;
  }
}

export async function CompanyDetail({
  company,
  contacts,
  activeTab,
  historyPeriod,
  registerVisit = false,
}: CompanyDetailProps) {
  const location = [company.city, company.province].filter(Boolean).join(" · ");
  const resolvedTab = isCompanyDetailTab(activeTab) ? activeTab : DEFAULT_COMPANY_DETAIL_TAB;
  const priority = await getCompanyPriorityInfo(company);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title={company.name}
        subtitle={location || "Scheda azienda premium"}
        actions={
          <>
            <Link href={`/companies/${company.id}/edit`} className="hidden sm:block">
              <Button variant="outline">
                <Pencil className="h-4 w-4" />
                Modifica
              </Button>
            </Link>
            <DeleteButton
              action={deleteCompanyAction.bind(null, company.id)}
              confirmMessage={`Eliminare "${company.name}"? Verranno rimossi anche i contatti collegati.`}
            />
          </>
        }
      />

      <CompanyDetailSummary
        companyId={company.id}
        commercialStatus={company.commercial_status}
        priorityTier={priority.tier}
        priorityScore={priority.score}
        registerVisit={registerVisit}
      />

      <Suspense fallback={null}>
        <CompanyDetailTabs companyId={company.id} />
      </Suspense>

      <CompanyDetailTabContent
        company={company}
        contacts={contacts}
        activeTab={resolvedTab}
        historyPeriod={historyPeriod}
      />

      <p className="text-right text-xs text-slate-400">
        Creata il {formatDate(company.created_at)} · aggiornata il {formatDate(company.updated_at)}
      </p>

      <CompanyMobileActionBar companyId={company.id} />
    </div>
  );
}
