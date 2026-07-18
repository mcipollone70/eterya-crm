import { LineChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { DashboardBarChart } from "@/features/dashboard/components/dashboard-bar-chart";
import { getAdvancedStatistics } from "./services/commercial-report.service";

function safeMonthlyData(
  points: Array<{ label: string; value: number }> | null | undefined,
) {
  if (!Array.isArray(points)) {
    return [];
  }
  return points
    .filter((p) => p != null && typeof p === "object" && typeof p.label === "string" && p.label.length > 0)
    .map((p) => ({
      label: p.label,
      value: Number.isFinite(p.value) ? p.value : 0,
    }));
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export async function AdvancedStatisticsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Statistiche avanzate" subtitle="Trend mensili e indicatori di vendita." />
        <EmptyState
          icon={LineChart}
          title="Database non configurato"
          message="Configura Supabase in .env.local per visualizzare le statistiche avanzate."
        />
      </div>
    );
  }

  const stats = await getAdvancedStatistics();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistiche avanzate"
        subtitle="Trend degli ultimi 6 mesi, dimensione media trattativa e tasso di successo."
      />

      {stats.error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Alcuni dati potrebbero essere incompleti: {stats.error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Tasso di successo"
          value={`${stats.winRate}%`}
          hint={`${stats.totalWon} vinte · ${stats.totalLost} perse`}
        />
        <StatTile
          label="Dimensione media trattativa"
          value={formatOpportunityAmount(stats.averageDealSize)}
          hint="media ordini vinti"
        />
        <StatTile
          label="Ordini vinti (totale)"
          value={stats.totalWon.toLocaleString("it-IT")}
          hint="storico opportunità vinte"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Valore ordini per mese</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DashboardBarChart
            data={safeMonthlyData(stats.ordersMonthlyValue)}
            horizontal={false}
            colorClassName="bg-emerald-500"
            valueFormat="currency"
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Opportunità vinte per mese</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DashboardBarChart
              data={safeMonthlyData(stats.wonMonthlyCount)}
              horizontal={false}
              colorClassName="bg-indigo-500"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opportunità perse per mese</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DashboardBarChart
              data={safeMonthlyData(stats.lostMonthlyCount)}
              horizontal={false}
              colorClassName="bg-rose-500"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
