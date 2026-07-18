"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, Loader2 } from "lucide-react";
import { FilterToggle } from "@/components/ui";

interface OrderFiltersBarProps {
  agents: Array<{ id: string; label: string }>;
  companies: Array<{ id: string; label: string }>;
}

function countActiveFilters(searchParams: URLSearchParams): number {
  let count = 0;
  if (searchParams.get("agent")) count += 1;
  if (searchParams.get("company")) count += 1;
  if (searchParams.get("from")) count += 1;
  if (searchParams.get("to")) count += 1;
  return count;
}

export function OrderFiltersBar({ agents, companies }: OrderFiltersBarProps) {
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
      router.push(`/ordini?${params.toString()}`);
    });
  }

  const filters = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:border-0 md:p-0 md:shadow-none">
      <div className="mb-3 hidden items-center gap-2 text-sm font-medium text-slate-900 md:flex">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        ) : (
          <Filter className="h-4 w-4 text-indigo-600" />
        )}
        Filtri ordini
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Agente</span>
          <select
            value={searchParams.get("agent") ?? ""}
            onChange={(event) => updateParam("agent", event.target.value)}
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          >
            <option value="">Tutti gli agenti</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Azienda</span>
          <select
            value={searchParams.get("company") ?? ""}
            onChange={(event) => updateParam("company", event.target.value)}
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          >
            <option value="">Tutte le aziende</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Data da</span>
          <input
            type="date"
            value={searchParams.get("from") ?? ""}
            onChange={(event) => updateParam("from", event.target.value)}
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Data a</span>
          <input
            type="date"
            value={searchParams.get("to") ?? ""}
            onChange={(event) => updateParam("to", event.target.value)}
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          />
        </label>
      </div>
    </div>
  );

  return <FilterToggle activeCount={activeCount}>{filters}</FilterToggle>;
}
