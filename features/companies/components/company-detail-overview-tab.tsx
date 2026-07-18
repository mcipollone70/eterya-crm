import Link from "next/link";
import { Plus, UserRound } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DescriptionItem,
  DescriptionList,
} from "@/components/ui";
import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { resolveCompanyDisplayFields, type Company } from "../services/companies.service";
import { CommercialStatusBadge } from "./commercial-status-badge";
import { CommercialStatusSelect } from "./commercial-status-select";
import { CompanyOverviewQuickActions } from "./company-detail-summary";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import {
  CompanyBrandsPanel,
} from "@/features/brands/components/company-brands-panel";
import { listBrands } from "@/features/brands/services/brands.service";
import {
  getCompanyBrandsSchemaCapabilities,
  listCompanyBrands,
} from "@/features/brands/services/company-brands.service";

interface CompanyDetailOverviewTabProps {
  company: Company;
  contacts: ContactListItem[];
}

export async function CompanyDetailOverviewTab({
  company,
  contacts,
}: CompanyDetailOverviewTabProps) {
  const display = resolveCompanyDisplayFields(company);
  const mapsUrl =
    company.latitude != null && company.longitude != null
      ? buildGoogleMapsDirectionsUrl(company.latitude, company.longitude)
      : null;

  const [companyBrandsResult, catalogResult] = await Promise.all([
    listCompanyBrands(company.id),
    listBrands({ activeOnly: true }),
  ]);
  const schema = getCompanyBrandsSchemaCapabilities() ?? {
    hasRelationshipStatus: false,
    hasCustomerCode: false,
  };

  return (
    <div className="space-y-4">
      <CompanyBrandsPanel
        companyId={company.id}
        initialBrands={companyBrandsResult.data}
        catalog={catalogResult.data}
        schema={schema}
        editable
      />

      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Panoramica</CardTitle>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <CommercialStatusSelect companyId={company.id} value={company.commercial_status} />
            <CommercialStatusBadge status={company.commercial_status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <CompanyOverviewQuickActions
            phone={display.phone}
            email={display.email}
            website={company.website}
            mapsUrl={mapsUrl}
          />

          <DescriptionList>
            <DescriptionItem label="Ragione sociale" value={company.name} span />
            <DescriptionItem
              label="Cliente / Prospect"
              value={COMMERCIAL_STATUS_LABELS[company.commercial_status ?? "prospect"]}
            />
            <DescriptionItem
              label="Stato commerciale"
              value={<CommercialStatusBadge status={company.commercial_status} />}
            />
            <DescriptionItem label="Categoria" value={company.category} />
            <DescriptionItem label="Referente" value={company.contact_name} />
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
            <DescriptionItem label="Partita IVA" value={display.vat_number} />
            <DescriptionItem label="Codice fiscale" value={company.tax_code} />
            <DescriptionItem
              label="Sito internet"
              value={
                company.website ? (
                  <a
                    className="text-indigo-600 hover:underline"
                    href={
                      company.website.startsWith("http")
                        ? company.website
                        : `https://${company.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {company.website}
                  </a>
                ) : null
              }
              span
            />
            <DescriptionItem label="Indirizzo" value={company.address} span />
            <DescriptionItem label="Comune" value={company.city} />
            <DescriptionItem label="Provincia" value={company.province} />
            <DescriptionItem label="CAP" value={company.postal_code} />
          </DescriptionList>
        </CardContent>
      </Card>

      <Card>
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
                        {[contact.role, contact.email, contact.phone].filter(Boolean).join(" · ") ||
                          "—"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
