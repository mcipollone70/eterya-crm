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
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {VISIT_PERIOD_OPTIONS.map((option) => {
        const active = (period === option.value) || (option.value === "today" && !searchParams.get("period"));
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => switchPeriod(option.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
