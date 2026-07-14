"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PRODUCT_FAMILY_OPTIONS } from "@/lib/constants/product-catalog";
import { resetCompaniesPageParam } from "../utils/companies-filter-navigation";

export function ProductFamilyFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("product_family") ?? "";

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    const value = event.target.value;

    if (value) {
      params.set("product_family", value);
    } else {
      params.delete("product_family");
    }

    resetCompaniesPageParam(params);
    const query = params.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      aria-label="Filtra per famiglia prodotto"
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
    >
      <option value="">Tutte le famiglie</option>
      {PRODUCT_FAMILY_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
