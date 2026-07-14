"use client";

import Link from "next/link";
import {
  Building2,
  CalendarPlus,
  Phone,
  Sparkles,
} from "lucide-react";
import { StickyActionBar } from "@/components/ui";

interface OpportunityMobileActionBarProps {
  companyId: string;
  callHref: string | null;
}

export function OpportunityMobileActionBar({
  companyId,
  callHref,
}: OpportunityMobileActionBarProps) {
  return (
    <StickyActionBar className="lg:hidden">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {callHref ? (
          <a
            href={callHref}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-2 text-xs font-medium text-white"
          >
            <Phone className="h-4 w-4" />
            Chiama
          </a>
        ) : (
          <span className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2 text-xs font-medium text-slate-400">
            <Phone className="h-4 w-4" />
            Chiama
          </span>
        )}
        <Link
          href={`/visits?company=${companyId}`}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-xs font-medium text-indigo-700"
        >
          <CalendarPlus className="h-4 w-4" />
          Pianifica visita
        </Link>
        <Link
          href={`/companies/${companyId}`}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"
        >
          <Building2 className="h-4 w-4" />
          Apri azienda
        </Link>
        <Link
          href={`/visits?company=${companyId}&briefing=${companyId}`}
          className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 sm:col-span-1"
        >
          <Sparkles className="h-4 w-4" />
          Apri briefing
        </Link>
      </div>
    </StickyActionBar>
  );
}
