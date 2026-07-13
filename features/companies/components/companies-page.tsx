import Link from "next/link";
import { Suspense } from "react";
import { Building2, FileSpreadsheet, MapPin, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isCommercialStatus } from "@/lib/constants/commercial-status";
import { listCompanies } from "../services/companies.service";
import { CommercialStatusBadge } from "./commercial-status-badge";
import { CommercialStatusFilter } from "./commercial-status-filter";
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
}

export async function CompaniesPage({ commercialStatus }: CompaniesPageProps) {
  const statusFilter: CommercialStatus | null = isCommercialStatus(commercialStatus)
    ? commercialStatus
    : null;

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

  const { data: companies, count, error } = await listCompanies(PAGE_SIZE, statusFilter);

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

      <div className="flex flex-wrap items-center gap-3">
        <Suspense fallback={null}>
          <CommercialStatusFilter />
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
                        {company.geocode_status === "geocoded" ? (
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
