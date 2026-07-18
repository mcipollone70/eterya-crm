"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui";
import type { FunnelStep } from "../services/commercial-report.service";
import type { CommercialKpiData } from "@/features/dashboard/types/commercial-kpi";

interface CommercialReportExportButtonProps {
  steps: FunnelStep[];
  kpi: CommercialKpiData;
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  if (/[",\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function CommercialReportExportButton({
  steps,
  kpi,
}: CommercialReportExportButtonProps) {
  function handleExport() {
    const rows: string[][] = [
      ["Sezione", "Indicatore", "Valore"],
      ...steps.map((step) => [
        "Imbuto",
        step.label,
        String(step.count),
      ]),
      ...steps
        .filter((step) => step.conversionFromPrevious != null)
        .map((step) => [
          "Conversione",
          `${step.label} vs precedente`,
          `${step.conversionFromPrevious}%`,
        ]),
      ["KPI", "Valore pipeline", String(kpi.pipelineValue)],
      ["KPI", "Opportunità aperte", String(kpi.openOpportunities)],
      ["KPI", "Tasso conversione", `${kpi.conversionRate}%`],
      ["KPI", "Ordini", String(kpi.ordersCount)],
      ["KPI", "Valore ordini", String(kpi.ordersValue)],
      ["KPI", "Preventivi accettati", String(kpi.quotesAccepted)],
      ["KPI", "Campioni in prestito", String(kpi.samplesOutstanding)],
      ["KPI", "Ticket assistenza aperti", String(kpi.serviceOpenTickets)],
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `report-commerciale-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4" />
      Esporta CSV
    </Button>
  );
}
