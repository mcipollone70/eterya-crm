import Link from "next/link";
import { Gauge } from "lucide-react";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import type { CommercialKpiData } from "../../types/commercial-kpi";
import { DashboardWidgetShell } from "./dashboard-widget-shell";

interface CommercialKpiWidgetProps {
  data: CommercialKpiData;
}

interface KpiTile {
  label: string;
  value: string;
  hint?: string;
  href: string;
  tone: string;
}

export function CommercialKpiWidget({ data }: CommercialKpiWidgetProps) {
  const tiles: KpiTile[] = [
    {
      label: "Valore pipeline",
      value: formatOpportunityAmount(data.pipelineValue),
      hint: `${data.openOpportunities.toLocaleString("it-IT")} opportunità aperte`,
      href: "/opportunities",
      tone: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Conversione",
      value: `${data.conversionRate}%`,
      hint: `${data.wonCount} vinte · ${data.lostCount} perse`,
      href: "/opportunities",
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Preventivi",
      value: `${data.quotesAccepted}/${data.quotesSent + data.quotesAccepted}`,
      hint: `${data.quoteAcceptanceRate}% accettati · ${data.quotesSent} inviati`,
      href: "/preventivi",
      tone: "text-blue-600 bg-blue-50",
    },
    {
      label: "Ordini",
      value: formatOpportunityAmount(data.ordersValue),
      hint: `${data.ordersCount.toLocaleString("it-IT")} ordini`,
      href: "/ordini",
      tone: "text-violet-600 bg-violet-50",
    },
    {
      label: "Campioni in prestito",
      value: data.samplesOutstanding.toLocaleString("it-IT"),
      hint: `${data.samplesPurchased} convertiti in acquisto`,
      href: "/campioni",
      tone: "text-amber-600 bg-amber-50",
    },
    {
      label: "Assistenza aperta",
      value: data.serviceOpenTickets.toLocaleString("it-IT"),
      hint: "ticket da gestire",
      href: "/assistenza",
      tone: "text-rose-600 bg-rose-50",
    },
  ];

  const maxStageValue = data.stageValues.reduce(
    (max, entry) => Math.max(max, entry.value),
    0
  );

  return (
    <DashboardWidgetShell
      title="KPI commerciali"
      icon={<Gauge className="h-4 w-4 text-indigo-600" />}
      action={
        <Link
          href="/reports"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Dashboard avanzata
        </Link>
      }
    >
      {data.error ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Alcuni KPI potrebbero essere incompleti: {data.error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="group rounded-xl border border-slate-100 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-sm"
          >
            <span
              className={`inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold ${tile.tone}`}
            >
              {tile.label}
            </span>
            <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">{tile.value}</p>
            {tile.hint ? <p className="mt-0.5 text-[11px] text-slate-500">{tile.hint}</p> : null}
          </Link>
        ))}
      </div>

      {data.stageValues.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-slate-500">Valore pipeline per fase</p>
          {data.stageValues.map((entry) => (
            <div key={entry.stage} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-xs text-slate-600">{entry.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{
                    width: maxStageValue > 0 ? `${Math.round((entry.value / maxStageValue) * 100)}%` : "0%",
                  }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">
                {formatOpportunityAmount(entry.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidgetShell>
  );
}
