import Link from "next/link";
import { CalendarCheck, Route, Target } from "lucide-react";

export function VisitFieldLinks() {
  return (
    <div className="flex w-full gap-2 sm:w-auto">
      <Link
        href="/activities?section=followups&fperiod=today"
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex-none sm:px-3"
        title="Follow-up oggi"
      >
        <CalendarCheck className="h-4 w-4" />
        <span className="hidden sm:inline">Follow-up oggi</span>
        <span className="sm:hidden">Follow-up</span>
      </Link>
      <Link
        href="/routes"
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex-none sm:px-3"
        title="Giro visite"
      >
        <Route className="h-4 w-4" />
        <span className="hidden sm:inline">Giro visite</span>
        <span className="sm:hidden">Giro</span>
      </Link>
      <Link
        href="/opportunities"
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        title="Pipeline"
      >
        <Target className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only sm:ml-0 sm:inline">Pipeline</span>
      </Link>
    </div>
  );
}
