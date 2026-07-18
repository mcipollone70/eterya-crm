"use client";

import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { COMMERCIAL_STATUS_MARKER_COLORS } from "@/features/maps/constants/map-config";

export function VisitTourMapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[220px] rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-sm">
      <p className="mb-2 font-semibold text-slate-900">Legenda</p>
      <ul className="space-y-1.5 text-slate-700">
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-sky-500" />
          Partenza
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-600" />
          Destinazione
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-indigo-600" />
          Tappa selezionata
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
    </div>
  );
}
