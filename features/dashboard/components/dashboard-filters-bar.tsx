"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, Loader2, X } from "lucide-react";
import {
  COMMERCIAL_STATUS_OPTIONS,
} from "@/lib/constants/commercial-status";
import {
  DASHBOARD_PERIOD_OPTIONS,
  hasActiveDashboardFilters,
  parseDashboardFilters,
  type CommercialDashboardFilters,
} from "@/lib/constants/dashboard-filters";
import { resolveDashboardPeriodRange } from "../utils/dashboard-period";

interface DashboardFiltersBarProps {
  agents: Array<{ id: string; label: string }>;
  provinces: string[];
  initialFilters: CommercialDashboardFilters;
}

export function DashboardFiltersBar({
  agents,
  provinces,
  initialFilters,
}: DashboardFiltersBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function applyFilters(next: CommercialDashboardFilters) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.agentId) {
      params.set("agent", next.agentId);
    } else {
      params.delete("agent");
    }

    if (next.province) {
      params.set("province", next.province);
    } else {
      params.delete("province");
    }

    if (next.commercialStatus) {
      params.set("status", next.commercialStatus);
    } else {
      params.delete("status");
    }

    if (next.period) {
      params.set("period", next.period);
    } else {
      params.delete("period");
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/reports?${query}` : "/reports");
    });
  }

  function handleChange(field: keyof CommercialDashboardFilters, value: string) {
    const next = { ...initialFilters };
    if (field === "agentId") {
      next.agentId = value || null;
    } else if (field === "province") {
      next.province = value || null;
    } else if (field === "commercialStatus") {
      next.commercialStatus = (value || null) as CommercialDashboardFilters["commercialStatus"];
    } else if (field === "period") {
      next.period = value as CommercialDashboardFilters["period"];
    }
    applyFilters(next);
  }

  function clearFilters() {
    startTransition(() => {
      router.push("/reports");
    });
  }

  const periodRange = resolveDashboardPeriodRange(initialFilters.period);
  const active = hasActiveDashboardFilters(initialFilters);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          ) : (
            <Filter className="h-4 w-4 text-indigo-600" />
          )}
          Filtri analytics
        </div>
        {active && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
            Azzera filtri
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Agente</span>
          <select
            value={initialFilters.agentId ?? ""}
            onChange={(event) => handleChange("agentId", event.target.value)}
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
          <span className="mb-1 block text-xs font-medium text-slate-600">Provincia</span>
          <select
            value={initialFilters.province ?? ""}
            onChange={(event) => handleChange("province", event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tutte le province</option>
            {provinces.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Stato cliente</span>
          <select
            value={initialFilters.commercialStatus ?? ""}
            onChange={(event) => handleChange("commercialStatus", event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tutti gli stati</option>
            {COMMERCIAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Periodo</span>
          <select
            value={initialFilters.period}
            onChange={(event) => handleChange("period", event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {DASHBOARD_PERIOD_OPTIONS.map((option) => (
              <option key={option.value || "default"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {active && (
        <p className="mt-3 text-xs text-slate-500">
          Vista filtrata
          {initialFilters.agentId
            ? ` · agente ${agents.find((agent) => agent.id === initialFilters.agentId)?.label ?? ""}`
            : ""}
          {initialFilters.province ? ` · provincia ${initialFilters.province}` : ""}
          {initialFilters.commercialStatus
            ? ` · stato ${COMMERCIAL_STATUS_OPTIONS.find((option) => option.value === initialFilters.commercialStatus)?.label ?? ""}`
            : ""}
          {periodRange ? ` · periodo ${periodRange.label}` : ""}
        </p>
      )}
    </div>
  );
}
