"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { COMPANY_DETAIL_PERIOD_OPTIONS } from "../constants/company-detail-tabs";

interface CompanyDetailActivityFiltersProps {
  companyId: string;
}

export function CompanyDetailActivityFilters({ companyId }: CompanyDetailActivityFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updatePeriod(period: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "attivita");
    if (period) {
      params.set("period", period);
    } else {
      params.delete("period");
    }
    router.push(`/companies/${companyId}?${params.toString()}`);
  }

  const activePeriod = searchParams.get("period") ?? "";

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {COMPANY_DETAIL_PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value || "all"}
          type="button"
          onClick={() => updatePeriod(option.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            activePeriod === option.value
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
