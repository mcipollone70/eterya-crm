import Link from "next/link";
import { Building2, FileSpreadsheet, LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  DASHBOARD_COMMERCIAL_STATUS_LABELS,
  DASHBOARD_COMMERCIAL_STATUSES,
  type DashboardCommercialStatus,
} from "@/lib/constants/commercial-status";
import { getCommercialStatusCounts } from "@/features/companies/services/companies.service";
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
  const { data: counts, error } = configured
    ? await getCommercialStatusCounts()
    : { data: null, error: null };

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

      {configured && error && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-600">
            Impossibile caricare i conteggi: {error}
          </CardContent>
        </Card>
      )}

      {configured && !error && (
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
      )}

      {configured && !error && !hasData && (
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
