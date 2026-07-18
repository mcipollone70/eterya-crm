import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseDashboardFilters } from "@/lib/constants/dashboard-filters";
import {
  getCommercialDashboardData,
  getDashboardFilterOptions,
  getUserDashboardLayout,
} from "./services/commercial-dashboard.service";
import { AdvancedDashboardClient } from "./components/advanced-dashboard-client";
import { DashboardFiltersBar } from "./components/dashboard-filters-bar";
import { JoyAiPageLink } from "@/features/joy/components/joy-ai-page-link";

interface AdvancedDashboardPageProps {
  agent?: string;
  province?: string;
  status?: string;
  period?: string;
}

export async function AdvancedDashboardPage({
  agent,
  province,
  status,
  period,
}: AdvancedDashboardPageProps) {
  const configured = isSupabaseConfigured();
  const filters = parseDashboardFilters({ agent, province, status, period });

  if (!configured) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Commerciale Avanzata</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configura Supabase per visualizzare KPI, grafici e widget operativi.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <BarChart3 className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Database non configurato</h3>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [dashboardResult, layoutResult, filterOptionsResult] = await Promise.all([
    getCommercialDashboardData(filters),
    getUserDashboardLayout(),
    getDashboardFilterOptions(),
  ]);

  if (dashboardResult.error || !dashboardResult.data) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Commerciale Avanzata</h2>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-600">
            Impossibile caricare la dashboard: {dashboardResult.error}
          </CardContent>
        </Card>
      </div>
    );
  }

  const filterOptions = filterOptionsResult.data ?? { agents: [], provinces: [] };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Report commerciali</h2>
          <p className="mt-1 text-sm text-slate-500">KPI, trend e indicatori di vendita.</p>
        </div>
        <JoyAiPageLink prompt="Mostrami le statistiche commerciali" />
      </div>

      <Suspense fallback={null}>
        <DashboardFiltersBar
          agents={filterOptions.agents}
          provinces={filterOptions.provinces}
          initialFilters={filters}
        />
      </Suspense>

      <AdvancedDashboardClient
        data={dashboardResult.data}
        initialLayout={layoutResult.data}
        filters={filters}
      />
    </div>
  );
}
