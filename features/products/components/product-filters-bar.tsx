"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, Loader2, Search } from "lucide-react";
import { FilterToggle } from "@/components/ui";
import {
  PRODUCT_FAMILY_OPTIONS,
  PRODUCT_FAMILY_LABELS,
} from "@/lib/constants/product-catalog";
import { PRODUCT_ACTIVE_OPTIONS } from "@/lib/constants/product-filters";

function countActiveFilters(searchParams: URLSearchParams): number {
  let count = 0;
  if (searchParams.get("family")) count += 1;
  if (searchParams.get("active")) count += 1;
  if (searchParams.get("q")) count += 1;
  return count;
}

export function ProductFiltersBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const activeCount = countActiveFilters(searchParams);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`/products?${params.toString()}`);
    });
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateParam("q", String(formData.get("q") ?? "").trim());
  }

  const filters = (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:border-0 md:p-0 md:shadow-none">
      <div className="hidden items-center gap-2 text-sm font-medium text-slate-900 md:flex">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        ) : (
          <Filter className="h-4 w-4 text-indigo-600" />
        )}
        Filtri catalogo
      </div>

      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Cerca per nome prodotto..."
            className="field-input w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Cerca
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Famiglia</span>
          <select
            value={searchParams.get("family") ?? ""}
            onChange={(event) => updateParam("family", event.target.value)}
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          >
            <option value="">Tutte le famiglie</option>
            {PRODUCT_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {PRODUCT_FAMILY_LABELS[option.value]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Stato</span>
          <select
            value={searchParams.get("active") ?? ""}
            onChange={(event) => updateParam("active", event.target.value)}
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          >
            {PRODUCT_ACTIVE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );

  return <FilterToggle activeCount={activeCount}>{filters}</FilterToggle>;
}
