"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { MapCompaniesStats } from "../types/map";
import { MapCompaniesProvider } from "./map-companies-provider";

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
  provinces: string[];
  stats: MapCompaniesStats;
  brands: Array<{ id: string; name: string; slug: string; color: string | null }>;
}

export function CompaniesMapClient({ provinces, stats, brands }: CompaniesMapClientProps) {
  return (
    <MapCompaniesProvider stats={stats}>
      <Suspense
        fallback={
          <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
            Caricamento filtri mappa…
          </div>
        }
      >
        <CompaniesMap provinces={provinces} brands={brands} />
      </Suspense>
    </MapCompaniesProvider>
  );
}
