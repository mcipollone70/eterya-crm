import Link from "next/link";
import { CalendarCheck, Route, Target } from "lucide-react";

export function VisitFieldLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/activities?section=followups&fperiod=today"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <CalendarCheck className="h-4 w-4" />
        Follow-up oggi
      </Link>
      <Link
        href="/routes"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Route className="h-4 w-4" />
        Giro visite
      </Link>
      <Link
        href="/opportunities"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Target className="h-4 w-4" />
        Pipeline
      </Link>
    </div>
  );
}
