"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, Loader2 } from "lucide-react";
import { FilterToggle } from "@/components/ui";
import { AGENDA_KIND_OPTIONS } from "@/lib/constants/agenda";

interface SharedCalendarFiltersProps {
  agents: Array<{ id: string; label: string }>;
}

function countActiveFilters(searchParams: URLSearchParams): number {
  let count = 0;
  if (searchParams.get("agent")) count += 1;
  if (searchParams.get("kind")) count += 1;
  if (searchParams.get("date")) count += 1;
  return count;
}

export function SharedCalendarFilters({ agents }: SharedCalendarFiltersProps) {
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
      router.push(`/calendario?${params.toString()}`);
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
        Filtri calendario
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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
          <span className="mb-1 block text-xs font-medium text-slate-600">Tipologia</span>
          <select
            value={searchParams.get("kind") ?? ""}
            onChange={(event) => updateParam("kind", event.target.value)}
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          >
            {AGENDA_KIND_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Settimana del</span>
          <input
            type="date"
            value={searchParams.get("date") ?? ""}
            onChange={(event) => updateParam("date", event.target.value)}
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          />
        </label>
      </div>
    </div>
  );

  return <FilterToggle activeCount={activeCount}>{filters}</FilterToggle>;
}
