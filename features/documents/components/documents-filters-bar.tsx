"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, Loader2, Search } from "lucide-react";
import { FilterToggle } from "@/components/ui";
import { DOCUMENT_ENTITY_LABELS, DOCUMENT_ENTITY_TYPES } from "@/lib/constants/documents";

function countActiveFilters(searchParams: URLSearchParams): number {
  let count = 0;
  if (searchParams.get("type")) count += 1;
  if (searchParams.get("q")) count += 1;
  return count;
}

export function DocumentsFiltersBar() {
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
      router.push(`/documenti?${params.toString()}`);
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
        Filtri documenti
      </div>

      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Cerca per nome file..."
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

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600">Tipo collegamento</span>
        <select
          value={searchParams.get("type") ?? ""}
          onChange={(event) => updateParam("type", event.target.value)}
          className="field-input w-full rounded-lg border border-slate-200 px-3 sm:max-w-xs"
        >
          <option value="">Tutti i collegamenti</option>
          {DOCUMENT_ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {DOCUMENT_ENTITY_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return <FilterToggle activeCount={activeCount}>{filters}</FilterToggle>;
}
