import { Sparkles } from "lucide-react";
import type { IntelligentDashboardGreeting } from "../../types/intelligent-dashboard";

interface GreetingWidgetProps {
  data: IntelligentDashboardGreeting;
}

export function GreetingWidget({ data }: GreetingWidgetProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-5 py-6 text-white shadow-lg sm:px-7 sm:py-8">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 left-1/3 h-24 w-24 rounded-full bg-violet-400/20 blur-xl" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Dashboard intelligente
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {data.salutation}, {data.userName}
          </h1>
          <p className="mt-2 text-sm text-indigo-100 sm:text-base">
            {data.weekdayLabel} · {data.dateLabel}
          </p>
        </div>
      </div>
    </section>
  );
}
