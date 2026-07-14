"use client";

import type { DashboardChartPoint } from "../types/commercial-dashboard";

interface DashboardBarChartProps {
  data: DashboardChartPoint[];
  horizontal?: boolean;
  colorClassName?: string;
  valueFormatter?: (value: number) => string;
}

export function DashboardBarChart({
  data,
  horizontal = true,
  colorClassName = "bg-indigo-500",
  valueFormatter = (value) => value.toLocaleString("it-IT"),
}: DashboardBarChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Nessun dato disponibile.</p>;
  }

  const maxValue = Math.max(...data.map((point) => point.value), 1);

  if (horizontal) {
    return (
      <div className="space-y-3">
        {data.map((point) => (
          <div key={point.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700">{point.label}</span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {valueFormatter(point.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${colorClassName}`}
                style={{ width: `${Math.max(4, (point.value / maxValue) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-48 items-end gap-2">
      {data.map((point) => (
        <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="text-[10px] tabular-nums text-slate-500">
            {valueFormatter(point.value)}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className={`w-full rounded-t-md ${colorClassName}`}
              style={{ height: `${Math.max(8, (point.value / maxValue) * 100)}%` }}
            />
          </div>
          <span className="w-full truncate text-center text-[10px] text-slate-600">
            {point.label}
          </span>
        </div>
      ))}
    </div>
  );
}
