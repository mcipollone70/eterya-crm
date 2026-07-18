import Link from "next/link";
import { BarChart3, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { getCommercialFunnel } from "./services/commercial-report.service";
import { SalesFunnel } from "./components/sales-funnel";
import { CommercialReportExportButton } from "./components/commercial-report-export-button";

function SummaryTile({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </Link>
  );
}

export async function CommercialReportPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Report Commerciali" subtitle="Imbuto di vendita e sintesi moduli." />
        <EmptyState
          icon={FileText}
          title="Database non configurato"
          message="Configura Supabase in .env.local per generare i report commerciali."
        />
      </div>
    );
  }

  const { steps, kpi } = await getCommercialFunnel();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Commerciali"
        subtitle="Imbuto di vendita, conversioni e sintesi dei moduli commerciali."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CommercialReportExportButton steps={steps} kpi={kpi} />
            <Link
              href="/reports"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard avanzata
            </Link>
          </div>
        }
      />

      {kpi.error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Alcuni dati potrebbero essere incompleti: {kpi.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Imbuto di vendita</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <SalesFunnel steps={steps} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile
          label="Valore pipeline"
          value={formatOpportunityAmount(kpi.pipelineValue)}
          href="/opportunities"
          hint={`${kpi.openOpportunities.toLocaleString("it-IT")} opportunità aperte`}
        />
        <SummaryTile
          label="Tasso conversione"
          value={`${kpi.conversionRate}%`}
          href="/opportunities"
          hint={`${kpi.wonCount} vinte · ${kpi.lostCount} perse`}
        />
        <SummaryTile
          label="Valore ordini"
          value={formatOpportunityAmount(kpi.ordersValue)}
          href="/ordini"
          hint={`${kpi.ordersCount.toLocaleString("it-IT")} ordini`}
        />
        <SummaryTile
          label="Preventivi accettati"
          value={`${kpi.quoteAcceptanceRate}%`}
          href="/preventivi"
          hint={`${kpi.quotesAccepted} su ${kpi.quotesSent + kpi.quotesAccepted}`}
        />
        <SummaryTile
          label="Campioni in prestito"
          value={kpi.samplesOutstanding.toLocaleString("it-IT")}
          href="/campioni"
          hint={`${kpi.samplesPurchased} convertiti`}
        />
        <SummaryTile
          label="Assistenza aperta"
          value={kpi.serviceOpenTickets.toLocaleString("it-IT")}
          href="/assistenza"
          hint="ticket da gestire"
        />
      </div>
    </div>
  );
}
