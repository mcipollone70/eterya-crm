"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { COMMERCIAL_STATUS_MARKER_COLORS } from "@/features/maps/constants/map-config";
import {
  MAP_BRAND_LEGEND_ITEMS,
  MAP_MULTI_BRAND_CROWN_LABEL,
} from "../utils/map-brand-markers";

/**
 * Mobile-only floating legend trigger + bottom sheet.
 * Desktop legends stay as fixed overlays; this replaces them under `lg`.
 */
export function MapMobileLegendControl() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[500] lg:hidden">
      <button
        type="button"
        data-testid="map-mobile-legend-button"
        className="pointer-events-auto absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden>ⓘ</span>
        Legenda
      </button>

      {open ? (
        <div
          className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-slate-900/40"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="map-mobile-legend-sheet"
            className="max-h-[70%] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl safe-bottom"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-sm font-semibold text-slate-900">
                Legenda
              </h2>
              <button
                type="button"
                data-testid="map-mobile-legend-close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Chiudi legenda"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Legenda Brand
              </h3>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {MAP_BRAND_LEGEND_ITEMS.map((item) => (
                  <li key={item.initial} className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">
                      {item.initial}
                    </span>
                    <span>
                      {item.initial} = {item.label}
                    </span>
                  </li>
                ))}
                <li className="flex items-start gap-2 pt-0.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center text-sm" aria-hidden>
                    👑
                  </span>
                  <span>{MAP_MULTI_BRAND_CROWN_LABEL}</span>
                </li>
              </ul>
            </section>

            <section className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Legenda Giro
              </h3>
              <ul className="space-y-1.5 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-sky-500" />
                  Partenza
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-indigo-600" />
                  Tappa selezionata
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-600" />
                  Destinazione
                </li>
                {Object.entries(COMMERCIAL_STATUS_LABELS).map(([status, label]) => (
                  <li key={status} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor:
                          COMMERCIAL_STATUS_MARKER_COLORS[
                            status as keyof typeof COMMERCIAL_STATUS_MARKER_COLORS
                          ],
                      }}
                    />
                    {label}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
