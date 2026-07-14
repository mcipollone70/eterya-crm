import Link from "next/link";
import { Building2, FileSpreadsheet, LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCommercialStatusCounts } from "@/features/companies/services/companies.service";
import { DASHBOARD_COMMERCIAL_STATUSES } from "@/lib/constants/commercial-status";
import { cn } from "@/utils/cn";
import { MissionControlDashboard } from "./components/mission-control-dashboard";
import { getMissionControlData } from "./services/mission-control.service";

export async function DashboardPage() {
  const configured = isSupabaseConfigured();

  if (!configured) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <LayoutDashboard className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Database non configurato</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Aggiungi le variabili Supabase in .env.local per avviare Mission Control.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [missionControl, countsResult] = await Promise.all([
    getMissionControlData(),
    getCommercialStatusCounts(),
  ]);

  const counts = countsResult.data;
  const hasData =
    counts != null && DASHBOARD_COMMERCIAL_STATUSES.some((key) => (counts[key] ?? 0) > 0);

  if (!hasData) {
    return (
      <div className="space-y-6">
        <MissionControlDashboard data={missionControl} />
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
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
      </div>
    );
  }

  return <MissionControlDashboard data={missionControl} />;
}
