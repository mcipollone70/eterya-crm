"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { INTEREST_LEVEL_OPTIONS } from "@/lib/constants/product-catalog";

export function InterestLevelFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("interest_level") ?? "";

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    const value = event.target.value;

    if (value) {
      params.set("interest_level", value);
    } else {
      params.delete("interest_level");
    }

    const query = params.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      aria-label="Filtra per livello di interesse"
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
    >
      <option value="">Tutti i livelli</option>
      {INTEREST_LEVEL_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
