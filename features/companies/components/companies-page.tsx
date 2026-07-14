import Link from "next/link";
import { Suspense } from "react";
import { Building2, FileSpreadsheet, MapPin, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { isGeocodedStatus } from "@/lib/constants/geocoding-status";
import { getGeoapifyConfigView } from "@/lib/geoapify/env";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isCommercialStatus } from "@/lib/constants/commercial-status";
import { isPriorityFilter, isPrioritySort } from "@/lib/constants/priority-tier";
import { isLastVisitFilter, isLastVisitSort } from "@/lib/constants/last-visit";
import { isInterestLevel, isProductFamily } from "@/lib/constants/product-catalog";
import { formatLastVisitLabel } from "@/lib/last-visit/format";
import { getGeocodingSummary } from "../services/company-geocoding.service";
import { listCompanies } from "../services/companies.service";
import { CommercialStatusBadge } from "./commercial-status-badge";
import { CommercialStatusFilter } from "./commercial-status-filter";
import { GeocodingPanel } from "./geocoding-panel";
import { PriorityBadge } from "./priority-badge";
import { PriorityFilter } from "./priority-filter";
import { PrioritySortToggle } from "./priority-sort-toggle";
import { LastVisitFilter } from "./last-visit-filter";
import { LastVisitSortToggle } from "./last-visit-sort-toggle";
import { ProductFamilyFilter } from "./product-family-filter";
import { InterestLevelFilter } from "./interest-level-filter";
import { PurchasedProductFilter } from "./purchased-product-filter";
import { listProducts } from "@/features/products/services/products.service";
import { DEFAULT_GEOAPIFY_CONFIG } from "../types/geocoding";
import type { CommercialStatus } from "@/lib/supabase/types";

const PAGE_SIZE = 100;

function ImportCta() {
  return (
    <Link
      href="/companies/import"
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
    >
      <FileSpreadsheet className="h-4 w-4" />
      Importa Aziende
    </Link>
  );
}

function CreateCta() {
  return (
    <Link
      href="/companies/new"
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
    >
      <Plus className="h-4 w-4" />
      Nuova azienda
    </Link>
  );
}

const HeaderActions = (
  <>
    <ImportCta />
    <CreateCta />
  </>
);

interface CompaniesPageProps {
  commercialStatus?: string;
  priorityTier?: string;
  lastVisit?: string;
  sort?: string;
  productFamily?: string;
  interestLevel?: string;
  purchasedProduct?: string;
}

export async function CompaniesPage({
  commercialStatus,
  priorityTier,
  lastVisit,
  sort,
  productFamily,
  interestLevel,
  purchasedProduct,
}: CompaniesPageProps) {
  const statusFilter: CommercialStatus | null = isCommercialStatus(commercialStatus)
    ? commercialStatus
    : null;
  const priorityFilter = isPriorityFilter(priorityTier) ? priorityTier : null;
  const lastVisitFilter = isLastVisitFilter(lastVisit) ? lastVisit : null;
  const sortByPriority = isPrioritySort(sort);
  const sortByLastVisit = isLastVisitSort(sort);
  const productFamilyFilter = isProductFamily(productFamily) ? productFamily : null;
  const interestLevelFilter = isInterestLevel(interestLevel) ? interestLevel : null;
  const purchasedProductFilter = purchasedProduct?.trim() || null;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Aziende" subtitle="Elenco delle aziende." actions={HeaderActions} />
        <EmptyState
          icon={Building2}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server per leggere e gestire le aziende."
        />
      </div>
    );
  }

  const [{ data: companies, count, error }, geocodingSummaryResult, productsResult] = await Promise.all([
    listCompanies(PAGE_SIZE, statusFilter, {
      priorityTier: priorityFilter,
      sortByPriority,
      lastVisitFilter,
      sortByLastVisit,
      productFamily: productFamilyFilter,
      interestLevel: interestLevelFilter,
      purchasedProductId: purchasedProductFilter,
    }),
    getGeocodingSummary(),
    listProducts({ activeOnly: true }),
  ]);

  const geocodingSummary = geocodingSummaryResult.data ?? {
    withoutCoordinates: 0,
    geocoded: 0,
    needsReview: 0,
    failed: 0,
  };
  const geoapifyConfig = getGeoapifyConfigView() ?? DEFAULT_GEOAPIFY_CONFIG;
  const catalogProducts = productsResult.data;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Aziende" subtitle="Elenco delle aziende." actions={HeaderActions} />
        <EmptyState icon={Building2} title="Impossibile caricare le aziende" message={error} />
      </div>
    );
  }

  if (companies.length === 0 && !statusFilter) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Aziende"
          subtitle="Nessuna azienda presente nel database."
          actions={HeaderActions}
        />
        <EmptyState
          icon={Building2}
          title="Nessuna azienda"
          message="Crea la tua prima azienda o importa un elenco da un file Excel per iniziare."
          action={<CreateCta />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aziende"
        subtitle={`${count.toLocaleString("it-IT")} aziende${
          statusFilter ? " con filtro attivo" : " nel database"
        }${
          count > companies.length
            ? ` · prime ${companies.length.toLocaleString("it-IT")} mostrate`
            : ""
        }.`}
        actions={HeaderActions}
      />

      <GeocodingPanel summary={geocodingSummary} geoapifyConfig={geoapifyConfig} />

      <div className="flex flex-wrap items-center gap-3">
        <Suspense fallback={null}>
          <CommercialStatusFilter />
        </Suspense>
        <Suspense fallback={null}>
          <PriorityFilter />
        </Suspense>
        <Suspense fallback={null}>
          <PrioritySortToggle />
        </Suspense>
        <Suspense fallback={null}>
          <LastVisitFilter />
        </Suspense>
        <Suspense fallback={null}>
          <LastVisitSortToggle />
        </Suspense>
        <Suspense fallback={null}>
          <ProductFamilyFilter />
        </Suspense>
        <Suspense fallback={null}>
          <InterestLevelFilter />
        </Suspense>
        <Suspense fallback={null}>
          <PurchasedProductFilter products={catalogProducts} />
        </Suspense>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nessun risultato"
          message="Nessuna azienda corrisponde al filtro selezionato."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Ragione sociale</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Comune</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Provincia</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">P.IVA</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Telefono</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Email</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Stato commerciale</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Priorità</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Ultima visita</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Geo</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr
                      key={company.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium text-indigo-600">
                        <Link href={`/companies/${company.id}`} className="hover:underline">
                          {company.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{company.city || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{company.province || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{company.vat_number || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{company.phone || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{company.email || "—"}</td>
                      <td className="px-4 py-3">
                        <CommercialStatusBadge status={company.commercial_status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge score={company.priority_score} tier={company.priority_tier} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatLastVisitLabel(company.last_visit_at)}
                      </td>
                      <td className="px-4 py-3">
                        {isGeocodedStatus(company.geocode_status) ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <MapPin className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
