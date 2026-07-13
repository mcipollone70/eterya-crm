"use client";

import { useTransition } from "react";
import { updateCommercialStatusAction } from "../actions/company-mutations";
import { COMMERCIAL_STATUS_OPTIONS } from "@/lib/constants/commercial-status";
import type { CommercialStatus } from "@/lib/supabase/types";

interface CommercialStatusSelectProps {
  companyId: string;
  value: CommercialStatus;
}

export function CommercialStatusSelect({ companyId, value }: CommercialStatusSelectProps) {
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as CommercialStatus;
    if (next === value) return;

    startTransition(async () => {
      await updateCommercialStatusAction(companyId, next);
    });
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={isPending}
      aria-label="Stato commerciale"
      className="h-9 min-w-[11rem] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-wait disabled:opacity-60"
    >
      {COMMERCIAL_STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
