"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, Loader2 } from "lucide-react";
import { FilterToggle } from "@/components/ui";

interface AssistantFiltersBarProps {
  agents: Array<{ id: string; label: string }>;
}

export function AssistantFiltersBar({ agents }: AssistantFiltersBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const activeCount = searchParams.get("agent") ? 1 : 0;

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`/assistant?${params.toString()}`);
    });
  }

  return (
    <FilterToggle activeCount={activeCount}>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:border-0 md:p-0 md:shadow-none">
        <div className="mb-3 hidden items-center gap-2 text-sm font-medium text-slate-900 md:flex">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          ) : (
            <Filter className="h-4 w-4 text-indigo-600" />
          )}
          Filtro agente
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Agente commerciale</span>
          <select
            value={searchParams.get("agent") ?? ""}
            onChange={(event) => updateParam("agent", event.target.value)}
            className="field-input w-full max-w-md rounded-lg border border-slate-200 px-3"
          >
            <option value="">Il mio portafoglio (default)</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </FilterToggle>
  );
}
