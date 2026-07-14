"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { AGENDA_VIEW_OPTIONS, type AgendaView } from "@/lib/constants/agenda";
import { shiftDateKey, toDateKey } from "@/lib/agenda/calendar";

interface AgendaViewTabsProps {
  referenceDate: string;
  rangeLabel: string;
}

export function AgendaViewTabs({ referenceDate, rangeLabel }: AgendaViewTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const view = (searchParams.get("view") as AgendaView) || "day";

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    startTransition(() => {
      router.push(`/agenda?${params.toString()}`);
    });
  }

  function switchView(next: AgendaView) {
    pushParams({ view: next });
  }

  function navigate(delta: number) {
    const step = view === "month" ? 30 : view === "week" ? 7 : 1;
    pushParams({ date: shiftDateKey(referenceDate, delta * step) });
  }

  function goToday() {
    pushParams({ date: toDateKey(new Date()) });
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {AGENDA_VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => switchView(option.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              view === option.value ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-2 text-slate-700 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-[180px] text-center text-sm font-medium capitalize text-slate-900">
          {rangeLabel}
        </div>
        <button
          type="button"
          onClick={() => navigate(1)}
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-2 text-slate-700 hover:bg-slate-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={goToday}
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Oggi
        </button>
      </div>
    </div>
  );
}
