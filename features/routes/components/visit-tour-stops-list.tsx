"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lock,
  LockOpen,
  Trash2,
} from "lucide-react";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import type { VisitTourOptimizeStop } from "../types/visit-tour";
import { buildGoogleMapsDestinationUrl, GOOGLE_MAPS_LINK_TARGET, isValidGeoPoint } from "../utils/google-maps-tour-url";

interface VisitTourStopsListProps {
  stops: VisitTourOptimizeStop[];
  onRemove: (companyId: string) => void;
  onMoveUp: (companyId: string) => void;
  onMoveDown: (companyId: string) => void;
  onToggleLock: (companyId: string) => void;
}

function stopNavUrl(stop: VisitTourOptimizeStop): string | null {
  const point = { lat: stop.company.latitude, lng: stop.company.longitude };
  if (!isValidGeoPoint(point)) {
    return null;
  }
  try {
    return buildGoogleMapsDestinationUrl(point);
  } catch {
    return null;
  }
}

export function VisitTourStopsList({
  stops,
  onRemove,
  onMoveUp,
  onMoveDown,
  onToggleLock,
}: VisitTourStopsListProps) {
  if (stops.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
        Nessuna tappa nel giro. Ottimizza o aggiungi manualmente un&apos;azienda.
      </p>
    );
  }

  return (
    <div className="max-h-[460px] space-y-2 overflow-y-auto rounded-lg border border-slate-100">
      {stops.map((stop, index) => {
        const navUrl = stopNavUrl(stop);
        return (
          <article
            key={stop.id}
            className={`space-y-2 border-b border-slate-100 p-3 last:border-0 ${
              stop.locked ? "bg-amber-50" : "bg-white"
            }`}
            data-testid={`tour-stop-${stop.order}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {stop.order}. {stop.company.name}
                </p>
                <p className="text-xs text-slate-500">
                  {stop.company.city || "—"}
                  {stop.company.province ? ` (${stop.company.province})` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                {stop.score} pt
              </span>
            </div>

            <div className="grid gap-1 text-xs text-slate-600">
              <p>Motivo: {stop.reason}</p>
              <p>
                Tratto: {formatDistanceKm(stop.legDistanceKm)} · Deviazione{" "}
                {formatDistanceKm(stop.deviationKm)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onToggleLock(stop.id)}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {stop.locked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Bloccata
                  </>
                ) : (
                  <>
                    <LockOpen className="h-3.5 w-3.5" />
                    Blocca
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onMoveUp(stop.id)}
                disabled={index === 0}
                className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMoveDown(stop.id)}
                disabled={index === stops.length - 1}
                className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRemove(stop.id)}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Rimuovi
              </button>
              <Link
                href={`/companies/${stop.id}`}
                className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Scheda
              </Link>
              <Link
                href={companyRegisterVisitHref(stop.id)}
                className="inline-flex min-h-10 items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                Visita
              </Link>
              {navUrl ? (
                <a
                  href={navUrl}
                  target={GOOGLE_MAPS_LINK_TARGET}
                  rel="noopener noreferrer"
                  data-testid={`google-maps-stop-${stop.id}`}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Avvia questa tappa
                </a>
              ) : (
                <span
                  className="inline-flex min-h-10 items-center rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 text-xs text-amber-800"
                  data-testid={`google-maps-stop-invalid-${stop.id}`}
                >
                  Coordinate non valide
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
