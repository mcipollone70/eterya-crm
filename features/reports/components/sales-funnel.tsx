import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import type { FunnelStep } from "../services/commercial-report.service";

interface SalesFunnelProps {
  steps: FunnelStep[];
}

const STEP_TONES = [
  "bg-indigo-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
];

export function SalesFunnel({ steps }: SalesFunnelProps) {
  const maxCount = steps.reduce((max, step) => Math.max(max, step.count), 0);

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const widthPct = maxCount > 0 ? Math.max(8, Math.round((step.count / maxCount) * 100)) : 8;
        return (
          <div key={step.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-slate-700">{step.label}</span>
              <span className="flex items-center gap-3 text-xs text-slate-500">
                {step.value > 0 ? (
                  <span className="tabular-nums">{formatOpportunityAmount(step.value)}</span>
                ) : null}
                {step.conversionFromPrevious != null ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {step.conversionFromPrevious}%
                  </span>
                ) : null}
                <span className="w-10 text-right font-semibold tabular-nums text-slate-900">
                  {step.count.toLocaleString("it-IT")}
                </span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${STEP_TONES[index] ?? "bg-slate-400"}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
