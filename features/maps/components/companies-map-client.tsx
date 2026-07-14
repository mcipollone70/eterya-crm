"use client";

import dynamic from "next/dynamic";
import type { MapCompaniesStats, MapCompany } from "../types/map";

const CompaniesMap = dynamic(
  () => import("./companies-map").then((module) => module.CompaniesMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
        Caricamento mappa…
      </div>
    ),
  }
);

interface CompaniesMapClientProps {
  companies: MapCompany[];
  provinces: string[];
  stats: MapCompaniesStats;
}

export function CompaniesMapClient({ companies, provinces, stats }: CompaniesMapClientProps) {
  return <CompaniesMap companies={companies} provinces={provinces} stats={stats} />;
}
