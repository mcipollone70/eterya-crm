"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ActivitiesSectionTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get("section") === "followups" ? "followups" : "history";

  function switchSection(next: "history" | "followups") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "history") {
      params.delete("section");
      params.delete("view");
      params.delete("fstatus");
      params.delete("fpriority");
      params.delete("fperiod");
      params.delete("fcompany");
    } else {
      params.set("section", "followups");
      if (!params.get("view")) {
        params.set("view", "list");
      }
    }
    const query = params.toString();
    router.push(query ? `/activities?${query}` : "/activities");
  }

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => switchSection("history")}
        className={`rounded-md px-4 py-1.5 text-sm font-medium ${
          section === "history" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        Storico contatti
      </button>
      <button
        type="button"
        onClick={() => switchSection("followups")}
        className={`rounded-md px-4 py-1.5 text-sm font-medium ${
          section === "followups" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        Follow-up
      </button>
    </div>
  );
}
