"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { VisitTourCompaniesProvider } from "./visit-tour-companies-provider";

const VisitTourPlanner = dynamic(
  () => import("./visit-tour-planner").then((module) => module.VisitTourPlanner),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
        Caricamento giro visite…
      </div>
    ),
  }
);

interface VisitTourClientProps {
  agents: Array<{ id: string; label: string }>;
}

export function VisitTourClient({ agents }: VisitTourClientProps) {
  return (
    <VisitTourCompaniesProvider>
      <Suspense
        fallback={
          <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
            Caricamento giro visite…
          </div>
        }
      >
        <VisitTourPlanner agents={agents} />
      </Suspense>
    </VisitTourCompaniesProvider>
  );
}
