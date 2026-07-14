"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LAST_VISIT_FILTER_OPTIONS } from "@/lib/constants/last-visit";

export function LastVisitFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("last_visit") ?? "";

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    const value = event.target.value;

    if (value) {
      params.set("last_visit", value);
    } else {
      params.delete("last_visit");
    }

    const query = params.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      aria-label="Filtra per ultima visita"
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
    >
      <option value="">Tutte le visite</option>
      {LAST_VISIT_FILTER_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
