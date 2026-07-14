"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/utils/cn";

interface VisitsMetricsBarProps {
  visitsToday: number;
  visitsThisWeek: number;
  neverVisitedCompanies: number;
  clientsWithoutVisit90Days: number;
}

export function VisitsMetricsBar({
  visitsToday,
  visitsThisWeek,
  neverVisitedCompanies,
  clientsWithoutVisit90Days,
}: VisitsMetricsBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm sm:hidden"
        aria-expanded={expanded}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Oggi</p>
          <p className="text-lg font-bold text-slate-900">
            {visitsToday} completate · {visitsThisWeek} settimana
          </p>
        </div>
        <ChevronDown className={cn("h-5 w-5 text-slate-400", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="grid gap-3 sm:hidden">
          <Card>
            <CardContent className="py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mai visitate</p>
              <p className="text-xl font-bold text-slate-900">{neverVisitedCompanies}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Clienti &gt; 90 gg
              </p>
              <p className="text-xl font-bold text-slate-900">{clientsWithoutVisit90Days}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completate oggi</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{visitsToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Settimana</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{visitsThisWeek}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mai visitate</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{neverVisitedCompanies}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Clienti &gt; 90 gg</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{clientsWithoutVisit90Days}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
