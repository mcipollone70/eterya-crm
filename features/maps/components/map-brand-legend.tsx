"use client";

import {
  MAP_BRAND_LEGEND_ITEMS,
  MAP_MULTI_BRAND_CROWN_LABEL,
} from "../utils/map-brand-markers";

/** Legenda compatta Brand marker (overlay mappa). */
export function MapBrandLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[220px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur-sm">
      <p className="mb-1.5 font-semibold text-slate-900">Brand</p>
      <ul className="space-y-1">
        {MAP_BRAND_LEGEND_ITEMS.map((item) => (
          <li key={item.initial} className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">
              {item.initial}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
        <li className="flex items-start gap-2 pt-0.5">
          <span className="inline-flex h-5 w-5 items-center justify-center text-sm" aria-hidden>
            👑
          </span>
          <span>{MAP_MULTI_BRAND_CROWN_LABEL}</span>
        </li>
      </ul>
    </div>
  );
}
