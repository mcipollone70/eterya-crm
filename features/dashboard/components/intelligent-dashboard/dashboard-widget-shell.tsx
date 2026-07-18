import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/utils/cn";

interface DashboardWidgetShellProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DashboardWidgetShell({
  title,
  icon,
  action,
  children,
  className,
  contentClassName,
}: DashboardWidgetShellProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-slate-200/80 shadow-sm transition-shadow duration-300 hover:shadow-md",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
          {icon}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

interface WidgetEmptyStateProps {
  message: string;
}

export function WidgetEmptyState({ message }: WidgetEmptyStateProps) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </p>
  );
}

interface WidgetMetricProps {
  label: string;
  value: number;
  tone?: "indigo" | "amber" | "rose" | "emerald" | "slate";
}

const METRIC_TONES: Record<NonNullable<WidgetMetricProps["tone"]>, string> = {
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  rose: "bg-rose-50 text-rose-700 border-rose-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
};

export function WidgetMetric({ label, value, tone = "slate" }: WidgetMetricProps) {
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", METRIC_TONES[tone])}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums">{value.toLocaleString("it-IT")}</p>
    </div>
  );
}
