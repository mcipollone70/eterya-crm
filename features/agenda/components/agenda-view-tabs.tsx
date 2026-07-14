"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { AGENDA_VIEW_OPTIONS, type AgendaView } from "@/lib/constants/agenda";
import { shiftDateKey, shiftMonthDateKey, toDateKey } from "@/lib/agenda/calendar";

interface AgendaViewTabsProps {
  referenceDate: string;
  rangeLabel: string;
}

const MOBILE_VIEWS: AgendaView[] = ["day", "week"];

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
    if (view === "month") {
      pushParams({ date: shiftMonthDateKey(referenceDate, delta) });
      return;
    }
    const step = view === "week" ? 7 : 1;
    pushParams({ date: shiftDateKey(referenceDate, delta * step) });
  }

  function goToday() {
    pushParams({ date: toDateKey(new Date()) });
  }

  return (
    <div className="sticky top-0 z-20 -mx-3 space-y-3 bg-slate-50/95 px-3 py-2 backdrop-blur-sm sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 lg:flex lg:flex-row lg:items-center lg:justify-between">
      <div className="inline-flex w-full gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
        {AGENDA_VIEW_OPTIONS.map((option) => {
          const hiddenOnMobile = !MOBILE_VIEWS.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => switchView(option.value)}
              className={`min-h-11 flex-1 rounded-md px-3 py-2 text-sm font-medium sm:flex-none sm:py-1.5 ${
                hiddenOnMobile ? "hidden sm:inline-flex" : "inline-flex"
              } ${
                view === option.value
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => switchView("month")}
          className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium sm:hidden ${
            view === "month" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Mese
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {isPending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-white"
          aria-label="Periodo precedente"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center text-sm font-medium capitalize text-slate-900 sm:min-w-[180px] sm:flex-none">
          {rangeLabel}
        </div>
        <button
          type="button"
          onClick={() => navigate(1)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-white"
          aria-label="Periodo successivo"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={goToday}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-white"
        >
          Oggi
        </button>
      </div>
    </div>
  );
}
