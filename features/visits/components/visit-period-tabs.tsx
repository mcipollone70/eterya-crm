"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { VISIT_PERIOD_OPTIONS } from "@/lib/constants/visit-workflow";

export function VisitPeriodTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const period = searchParams.get("period") ?? "today";

  function switchPeriod(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "today") {
      params.delete("period");
    } else {
      params.set("period", next);
    }
    const query = params.toString();
    router.push(query ? `/visits?${query}` : "/visits");
  }

  return (
    <div className="sticky top-0 z-20 -mx-3 bg-slate-50/95 px-3 py-2 backdrop-blur-sm sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0">
      <div className="inline-flex w-full gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
        {VISIT_PERIOD_OPTIONS.map((option) => {
          const active =
            period === option.value || (option.value === "today" && !searchParams.get("period"));
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => switchPeriod(option.value)}
              className={`min-h-11 flex-1 rounded-md px-3 py-2 text-sm font-medium sm:flex-none sm:py-1.5 ${
                active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
