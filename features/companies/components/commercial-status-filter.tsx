"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { COMMERCIAL_STATUS_OPTIONS } from "@/lib/constants/commercial-status";

export function CommercialStatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("commercial_status") ?? "";

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    const value = event.target.value;

    if (value) {
      params.set("commercial_status", value);
    } else {
      params.delete("commercial_status");
    }

    const query = params.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      aria-label="Filtra per stato commerciale"
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
    >
      <option value="">Tutti gli stati commerciali</option>
      {COMMERCIAL_STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
