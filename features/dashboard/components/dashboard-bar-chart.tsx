"use client";

import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import type { DashboardChartPoint } from "../types/commercial-dashboard";

type ValueFormat = "number" | "currency";

interface DashboardBarChartProps {
  data: DashboardChartPoint[] | null | undefined;
  horizontal?: boolean;
  colorClassName?: string;
  /** Serializable format preset — safe to pass from Server Components. */
  valueFormat?: ValueFormat;
  /**
   * Custom formatter — only pass from Client Components.
   * Functions are not serializable across the RSC boundary.
   */
  valueFormatter?: (value: number) => string;
}

function sanitizeChartData(
  data: DashboardChartPoint[] | null | undefined,
): DashboardChartPoint[] {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const points: DashboardChartPoint[] = [];

  for (const point of data) {
    if (point == null || typeof point !== "object") {
      continue;
    }

    const rawLabel = (point as DashboardChartPoint).label;
    const label =
      typeof rawLabel === "string"
        ? rawLabel
        : rawLabel == null
          ? ""
          : String(rawLabel);

    if (!label) {
      continue;
    }

    const rawValue = (point as DashboardChartPoint).value;
    const numeric =
      typeof rawValue === "number" ? rawValue : Number(rawValue);
    const value = Number.isFinite(numeric) ? numeric : 0;

    points.push({ label, value });
  }

  return points;
}

function defaultFormatter(format: ValueFormat): (value: number) => string {
  if (format === "currency") {
    return (value) => formatOpportunityAmount(value);
  }
  return (value) => {
    const safe = Number.isFinite(value) ? value : 0;
    return safe.toLocaleString("it-IT");
  };
}

export function DashboardBarChart({
  data,
  horizontal = true,
  colorClassName = "bg-indigo-500",
  valueFormat = "number",
  valueFormatter,
}: DashboardBarChartProps) {
  const safeData = sanitizeChartData(data);

  if (safeData.length === 0) {
    return <p className="text-sm text-slate-500">Nessun dato disponibile.</p>;
  }

  const formatValue = valueFormatter ?? defaultFormatter(valueFormat);
  const maxValue = Math.max(...safeData.map((point) => point.value), 1);

  if (horizontal) {
    return (
      <div className="space-y-3">
        {safeData.map((point) => (
          <div key={point.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700">{point.label}</span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {formatValue(point.value)}
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
      {safeData.map((point) => (
        <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="text-[10px] tabular-nums text-slate-500">
            {formatValue(point.value)}
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
