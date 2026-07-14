"use client";

import dynamic from "next/dynamic";
import type { MapCompany } from "@/features/maps/types/map";

const CommandCenterMiniMap = dynamic(
  () =>
    import("./command-center-mini-map").then((module) => module.CommandCenterMiniMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-56 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500 sm:h-72">
        Caricamento mappa…
      </div>
    ),
  }
);

interface CommandCenterMiniMapClientProps {
  companies: MapCompany[];
}

export function CommandCenterMiniMapClient({ companies }: CommandCenterMiniMapClientProps) {
  return <CommandCenterMiniMap companies={companies} />;
}
