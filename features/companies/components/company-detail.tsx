import Link from "next/link";
import { Pencil, Plus, Route, UserRound } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DeleteButton,
  DescriptionItem,
  DescriptionList,
  PageHeader,
} from "@/components/ui";
import { deleteCompanyAction } from "../actions/company-mutations";
import { COMPANY_STATUS_LABELS } from "../utils/company-fields";
import { CommercialStatusBadge } from "./commercial-status-badge";
import { CommercialStatusSelect } from "./commercial-status-select";
import type { Company } from "../services/companies.service";
import { resolveCompanyDisplayFields } from "../services/companies.service";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import { LastVisitSummary } from "@/features/visits/components/last-visit-summary";
import { RecordVisitForm } from "@/features/visits/components/record-visit-form";
import { CompanyContactHistorySection } from "@/features/activities/components/company-contact-history-section";
import { CompanyFollowUpsSection } from "@/features/activities/components/company-follow-ups-section";
import { CompanyOpportunitiesSection } from "@/features/opportunities/components/company-opportunities-section";
import { CompanyProductsSection } from "@/features/products/components/company-products-section";
import { CompanyMobileActionBar } from "./company-mobile-action-bar";

interface CompanyDetailProps {
  company: Company;
  contacts: ContactListItem[];
  historyType?: string;
  historyPeriod?: string;
  historyOperator?: string;
  historySearch?: string;
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

export function CompanyDetail({
  company,
  contacts,
  historyType,
  historyPeriod,
  historyOperator,
  historySearch,
  registerVisit = false,
}: CompanyDetailProps) {
  const location = [company.city, company.province].filter(Boolean).join(" · ");
  const display = resolveCompanyDisplayFields(company);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="order-1">
      <PageHeader
        title={company.name}
        subtitle={location || "Dettaglio azienda"}
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
      </div>

      <div className="order-2 lg:hidden">
      <LastVisitSummary
        company={company}
        actions={
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            <RecordVisitForm companyId={company.id} defaultOpen={registerVisit} />
            <Link
              href={`/voice?company=${company.id}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100 sm:h-8 sm:text-xs"
            >
              Dettatura vocale
            </Link>
            <Link
              href={`/visits?company=${company.id}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:h-8 sm:text-xs"
            >
              Agenda
            </Link>
            <Link
              href="/routes"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:h-8 sm:text-xs"
            >
              <Route className="h-3.5 w-3.5" />
              Giro
            </Link>
          </div>
        }
      />
      </div>

      <Card className="order-3 lg:order-2">
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Anagrafica</CardTitle>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <CommercialStatusSelect companyId={company.id} value={company.commercial_status} />
            <Badge>{COMPANY_STATUS_LABELS[company.status] ?? company.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList>
            <DescriptionItem
              label="Stato commerciale"
              value={<CommercialStatusBadge status={company.commercial_status} />}
            />
            <DescriptionItem label="Denominazione legale" value={company.legal_name} />
            <DescriptionItem label="Partita IVA" value={display.vat_number} />
            <DescriptionItem label="Codice fiscale" value={company.tax_code} />
            <DescriptionItem label="Categoria" value={company.category} />
            <DescriptionItem label="Settore" value={company.sector} />
          </DescriptionList>
        </CardContent>
      </Card>

      <Card className="order-4 lg:order-3">
        <CardHeader>
          <CardTitle>Indirizzo</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList>
            <DescriptionItem label="Indirizzo" value={company.address} span />
            <DescriptionItem label="CAP" value={company.postal_code} />
            <DescriptionItem label="Comune" value={company.city} />
            <DescriptionItem label="Provincia" value={company.province} />
            <DescriptionItem label="Regione" value={company.region} />
            <DescriptionItem label="Nazione" value={company.country} />
          </DescriptionList>
        </CardContent>
      </Card>

      <Card className="order-5 lg:order-4">
        <CardHeader>
          <CardTitle>Contatti azienda</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList>
            <DescriptionItem label="Telefono" value={display.phone} />
            <DescriptionItem label="Cellulare" value={company.mobile} />
            <DescriptionItem
              label="Email"
              value={
                display.email ? (
                  <a className="text-indigo-600 hover:underline" href={`mailto:${display.email}`}>
                    {display.email}
                  </a>
                ) : null
              }
            />
            <DescriptionItem label="PEC" value={company.pec} />
            <DescriptionItem
              label="Sito web"
              value={
                company.website ? (
                  <a
                    className="text-indigo-600 hover:underline"
                    href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {company.website}
                  </a>
                ) : null
              }
              span
            />
            <DescriptionItem label="Referente" value={company.contact_name} />
            <DescriptionItem label="Ruolo referente" value={company.contact_role} />
            <DescriptionItem label="Telefono referente" value={company.contact_phone} />
            <DescriptionItem label="Email referente" value={company.contact_email} />
          </DescriptionList>
        </CardContent>
      </Card>

      {(company.notes || company.internal_notes) && (
        <Card className="order-6 lg:order-5">
          <CardHeader>
            <CardTitle>Note</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList>
              <DescriptionItem label="Note" value={company.notes} span />
              <DescriptionItem label="Note interne" value={company.internal_notes} span />
            </DescriptionList>
          </CardContent>
        </Card>
      )}

      <div className="order-7 lg:order-6">
        <CompanyOpportunitiesSection companyId={company.id} contacts={contacts} />
      </div>

      <div className="order-8 lg:order-7">
        <CompanyProductsSection companyId={company.id} />
      </div>

      <div className="order-9 lg:order-8">
        <CompanyFollowUpsSection companyId={company.id} contacts={contacts} />
      </div>

      <div className="order-9 hidden lg:block">
        <LastVisitSummary
          company={company}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <RecordVisitForm companyId={company.id} defaultOpen={registerVisit} />
              <Link
                href={`/voice?company=${company.id}`}
                className="inline-flex h-8 items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                Dettatura vocale
              </Link>
              <Link
                href={`/visits?company=${company.id}`}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Agenda
              </Link>
              <Link
                href="/routes"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Route className="h-3.5 w-3.5" />
                Giro
              </Link>
            </div>
          }
        />
      </div>

      <div className="order-10 lg:order-10">
      <CompanyContactHistorySection
        companyId={company.id}
        basePath={`/companies/${company.id}`}
        type={historyType}
        period={historyPeriod}
        operator={historyOperator}
        search={historySearch}
      />
      </div>

      <Card className="order-11 lg:order-11">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Referenti ({contacts.length})</CardTitle>
          <Link href={`/contacts/new?company_id=${company.id}`}>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" />
              Aggiungi referente
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="pt-2">
          {contacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Nessun referente collegato a questa azienda.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <UserRound className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                        {contact.full_name}
                        {contact.is_primary && <Badge variant="info">Principale</Badge>}
                      </span>
                      <span className="text-xs text-slate-500">
                        {[contact.role, contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="order-12 text-right text-xs text-slate-400">
        Creata il {formatDate(company.created_at)} · aggiornata il {formatDate(company.updated_at)}
      </p>

      <CompanyMobileActionBar companyId={company.id} />
    </div>
  );
}
