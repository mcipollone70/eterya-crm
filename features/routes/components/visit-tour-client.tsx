"use client";

import dynamic from "next/dynamic";
import type { VisitTourCompany } from "../types/visit-tour";

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
  companies: VisitTourCompany[];
}

export function VisitTourClient({ companies }: VisitTourClientProps) {
  return <VisitTourPlanner companies={companies} />;
}
