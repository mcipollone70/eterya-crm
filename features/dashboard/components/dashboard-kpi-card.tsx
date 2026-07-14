"use client";

import Link from "next/link";
import { GripVertical } from "lucide-react";
import { cn } from "@/utils/cn";

interface DashboardKpiCardProps {
  title: string;
  value: string;
  href: string;
  tone?: "indigo" | "blue" | "emerald" | "amber" | "rose" | "violet" | "cyan" | "slate";
  draggable?: boolean;
  hidden?: boolean;
  onToggleHidden?: () => void;
}

const TONE_STYLES: Record<NonNullable<DashboardKpiCardProps["tone"]>, string> = {
  indigo: "border-indigo-100 bg-indigo-50/60 text-indigo-700",
  blue: "border-blue-100 bg-blue-50/60 text-blue-700",
  emerald: "border-emerald-100 bg-emerald-50/60 text-emerald-700",
  amber: "border-amber-100 bg-amber-50/60 text-amber-700",
  rose: "border-rose-100 bg-rose-50/60 text-rose-700",
  violet: "border-violet-100 bg-violet-50/60 text-violet-700",
  cyan: "border-cyan-100 bg-cyan-50/60 text-cyan-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

export function DashboardKpiCard({
  title,
  value,
  href,
  tone = "indigo",
  draggable = false,
  hidden = false,
  onToggleHidden,
}: DashboardKpiCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md",
        hidden && "opacity-50"
      )}
    >
      {draggable && (
        <span className="absolute left-2 top-2 cursor-grab text-slate-300 group-hover:text-slate-500">
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      {onToggleHidden && (
        <button
          type="button"
          onClick={onToggleHidden}
          className="absolute right-2 top-2 rounded px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100"
        >
          {hidden ? "Mostra" : "Nascondi"}
        </button>
      )}
      <Link href={href} className="block">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className={cn("mt-2 text-3xl font-bold tabular-nums", TONE_STYLES[tone])}>{value}</p>
      </Link>
    </div>
  );
}
