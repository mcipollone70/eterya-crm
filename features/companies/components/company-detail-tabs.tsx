"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { COMPANY_DETAIL_TABS } from "../constants/company-detail-tabs";

interface CompanyDetailTabsProps {
  companyId: string;
}

export function CompanyDetailTabs({ companyId }: CompanyDetailTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "panoramica";

  function switchTab(tabId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "panoramica") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }

    if (tabId !== "attivita") {
      params.delete("period");
      params.delete("type");
      params.delete("operator");
      params.delete("q");
    }

    const query = params.toString();
    router.push(query ? `/companies/${companyId}?${query}` : `/companies/${companyId}`);
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex min-w-full gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:min-w-0">
        {COMPANY_DETAIL_TABS.map((tab) => {
          const selected = searchParams.get("tab")
            ? activeTab === tab.id
            : tab.id === "panoramica";

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                selected ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
