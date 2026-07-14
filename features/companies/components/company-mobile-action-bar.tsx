"use client";

import Link from "next/link";
import { CalendarPlus, MapPin, Mic } from "lucide-react";
import { StickyActionBar } from "@/components/ui";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";

interface CompanyMobileActionBarProps {
  companyId: string;
}

/** Azioni rapide fisse sulla scheda azienda (solo mobile). */
export function CompanyMobileActionBar({ companyId }: CompanyMobileActionBarProps) {
  return (
    <StickyActionBar className="lg:hidden">
      <div className="grid grid-cols-4 gap-2">
        <Link
          href={companyRegisterVisitHref(companyId)}
          className="inline-flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg bg-indigo-600 px-1 text-[10px] font-medium text-white"
        >
          <MapPin className="h-4 w-4" />
          Registra
        </Link>
        <Link
          href={`/voice?company=${companyId}`}
          className="inline-flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-indigo-200 bg-indigo-50 px-1 text-[10px] font-medium text-indigo-700"
        >
          <Mic className="h-4 w-4" />
          Vocale
        </Link>
        <Link
          href={`/visits?company=${companyId}`}
          className="inline-flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 text-[10px] font-medium text-slate-700"
        >
          <CalendarPlus className="h-4 w-4" />
          Pianifica
        </Link>
        <Link
          href={`/assistant?briefing=${companyId}`}
          className="inline-flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 text-[10px] font-medium text-slate-700"
        >
          Briefing
        </Link>
      </div>
    </StickyActionBar>
  );
}
