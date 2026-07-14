"use client";

import dynamic from "next/dynamic";
import type { MapCompany } from "../types/map";

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
}

export function CompaniesMapClient({ companies, provinces }: CompaniesMapClientProps) {
  return <CompaniesMap companies={companies} provinces={provinces} />;
}
