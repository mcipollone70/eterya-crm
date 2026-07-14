"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  CONTACT_HISTORY_PERIOD_OPTIONS,
  CONTACT_HISTORY_TYPE_OPTIONS,
} from "@/lib/constants/contact-history";
import type { OperatorOption } from "../services/contact-history.service";

interface ContactHistoryFiltersProps {
  operators: OperatorOption[];
  basePath?: string;
}

export function ContactHistoryFilters({
  operators,
  basePath = "/activities",
}: ContactHistoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        defaultValue={searchParams.get("q") ?? ""}
        placeholder="Cerca nello storico..."
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            updateParam("q", (event.target as HTMLInputElement).value.trim());
          }
        }}
        className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
      />

      <select
        value={searchParams.get("type") ?? ""}
        onChange={(event) => updateParam("type", event.target.value)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
      >
        <option value="">Tutti i tipi</option>
        {CONTACT_HISTORY_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("period") ?? ""}
        onChange={(event) => updateParam("period", event.target.value)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
      >
        {CONTACT_HISTORY_PERIOD_OPTIONS.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("operator") ?? ""}
        onChange={(event) => updateParam("operator", event.target.value)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
      >
        <option value="">Tutti gli operatori</option>
        {operators.map((operator) => (
          <option key={operator.id} value={operator.id}>
            {operator.label}
          </option>
        ))}
      </select>
    </div>
  );
}
