"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { resetCompaniesPageParam } from "../utils/companies-filter-navigation";

export function LastVisitSortToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLastVisitSort = searchParams.get("sort") === "last_visit";

  function handleToggle() {
    const params = new URLSearchParams(searchParams.toString());

    if (isLastVisitSort) {
      params.delete("sort");
    } else {
      params.set("sort", "last_visit");
    }

    resetCompaniesPageParam(params);
    const query = params.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`h-9 rounded-lg border px-3 text-sm font-medium shadow-sm transition-colors ${
        isLastVisitSort
          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      Ordina per ultima visita
    </button>
  );
}
