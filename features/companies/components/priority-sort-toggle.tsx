"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function PrioritySortToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPrioritySort = searchParams.get("sort") === "priority";

  function handleToggle() {
    const params = new URLSearchParams(searchParams.toString());

    if (isPrioritySort) {
      params.delete("sort");
    } else {
      params.set("sort", "priority");
    }

    const query = params.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`h-9 rounded-lg border px-3 text-sm font-medium shadow-sm transition-colors ${
        isPrioritySort
          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      Ordina per punteggio
    </button>
  );
}
