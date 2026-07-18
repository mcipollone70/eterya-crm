"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CompanySelect } from "@/features/companies/components/company-select";
import {
  FOLLOW_UP_PERIOD_OPTIONS,
  FOLLOW_UP_PRIORITY_OPTIONS,
  FOLLOW_UP_STATUS_OPTIONS,
} from "@/lib/constants/follow-up";

export function FollowUpFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "calendar" ? "calendar" : "list";
  const selectedCompanyId = searchParams.get("fcompany") ?? "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "followups");
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const query = params.toString();
    router.push(`/activities?${query}`);
  }

  function switchView(next: "list" | "calendar") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "followups");
    params.set("view", next);
    router.push(`/activities?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => switchView("list")}
          className={`h-9 rounded-lg border px-3 text-sm font-medium ${
            view === "list"
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Elenco
        </button>
        <button
          type="button"
          onClick={() => switchView("calendar")}
          className={`h-9 rounded-lg border px-3 text-sm font-medium ${
            view === "calendar"
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Calendario
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={searchParams.get("fstatus") ?? ""}
          onChange={(event) => updateParam("fstatus", event.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
        >
          <option value="">Tutti gli stati</option>
          {FOLLOW_UP_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("fpriority") ?? ""}
          onChange={(event) => updateParam("fpriority", event.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
        >
          <option value="">Tutte le priorità</option>
          {FOLLOW_UP_PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("fperiod") ?? ""}
          onChange={(event) => updateParam("fperiod", event.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
        >
          {FOLLOW_UP_PERIOD_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="min-w-[220px] flex-1 sm:max-w-sm">
          <CompanySelect
            value={selectedCompanyId}
            onChange={(companyId) => updateParam("fcompany", companyId)}
            allowEmpty
            emptyLabel="Tutte le aziende"
            placeholder="Tutte le aziende"
            pinnedIds={selectedCompanyId ? [selectedCompanyId] : []}
          />
        </div>
      </div>
    </div>
  );
}
