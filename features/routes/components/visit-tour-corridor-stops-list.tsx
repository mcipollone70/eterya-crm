"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Phone,
  Trash2,
} from "lucide-react";
import { COMPANY_STATUS_LABELS } from "@/features/companies/utils/company-fields";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import type { VisitTourCandidate } from "../types/visit-tour";

interface VisitTourCorridorStopsListProps {
  stops: VisitTourCandidate[];
  selectionOrder: string[];
  isSuggestedOrder: boolean;
  onToggleCompany: (companyId: string) => void;
  onMoveUp: (companyId: string) => void;
  onMoveDown: (companyId: string) => void;
  onClearAll: () => void;
}

function formatLastVisit(value: string | null): string {
  if (!value) {
    return "Mai visitata";
  }
  return new Date(value).toLocaleDateString("it-IT");
}

function formatNextActivity(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VisitTourCorridorStopsList({
  stops,
  selectionOrder,
  isSuggestedOrder,
  onToggleCompany,
  onMoveUp,
  onMoveDown,
  onClearAll,
}: VisitTourCorridorStopsListProps) {
  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  const orderedStops = selectionOrder
    .map((id) => stopById.get(id))
    .filter((stop): stop is VisitTourCandidate => stop !== undefined);

  if (orderedStops.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
        Nessuna tappa selezionata. Aggiungi aziende dalla lista candidati.
      </p>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Tappe selezionate ({orderedStops.length})
          </h4>
          {isSuggestedOrder && (
            <p className="text-xs text-indigo-700">Ordine suggerito</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Svuota
        </button>
      </div>

      <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-lg border border-slate-100">
        {orderedStops.map((stop, index) => (
          <article
            key={stop.id}
            className="space-y-2 border-b border-slate-100 bg-white p-3 last:border-0"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {index + 1}. {stop.name}
                </p>
                <p className="text-xs text-slate-500">
                  {stop.address || "—"} · {stop.city || "—"}
                  {stop.province ? ` (${stop.province})` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {formatDistanceKm(stop.distanceFromRouteKm)}
              </span>
            </div>

            <div className="grid gap-1 text-xs text-slate-600">
              <p>
                {COMMERCIAL_STATUS_LABELS[stop.commercial_status]} ·{" "}
                {COMPANY_STATUS_LABELS[stop.status]}
              </p>
              <p>Ultima visita: {formatLastVisit(stop.lastVisitAt)}</p>
              <p>Prossima attività: {formatNextActivity(stop.nextActivityAt)}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onMoveUp(stop.id)}
                disabled={index === 0}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2 text-xs disabled:opacity-40"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMoveDown(stop.id)}
                disabled={index === orderedStops.length - 1}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2 text-xs disabled:opacity-40"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onToggleCompany(stop.id)}
                className="inline-flex h-8 items-center rounded-lg border border-rose-200 px-2 text-xs text-rose-700 hover:bg-rose-50"
              >
                Rimuovi
              </button>
              <Link
                href={`/companies/${stop.id}`}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Dettaglio
              </Link>
              {stop.phone && (
                <a
                  href={`tel:${stop.phone}`}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Chiama
                </a>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Naviga
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
