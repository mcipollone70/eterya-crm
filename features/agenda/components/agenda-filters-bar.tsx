"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, Loader2 } from "lucide-react";
import {
  AGENDA_KIND_OPTIONS,
  AGENDA_STATUS_OPTIONS,
} from "@/lib/constants/agenda";

interface AgendaFiltersBarProps {
  agents: Array<{ id: string; label: string }>;
}

export function AgendaFiltersBar({ agents }: AgendaFiltersBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`/agenda?${params.toString()}`);
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        ) : (
          <Filter className="h-4 w-4 text-indigo-600" />
        )}
        Filtri agenda
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Agente</span>
          <select
            value={searchParams.get("agent") ?? ""}
            onChange={(event) => updateParam("agent", event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {AGENDA_KIND_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Stato</span>
          <select
            value={searchParams.get("status") ?? ""}
            onChange={(event) => updateParam("status", event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {AGENDA_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
