"use client";

import Link from "next/link";
import { Phone, X } from "lucide-react";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { COMPANY_STATUS_LABELS } from "@/features/companies/utils/company-fields";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import type { VisitTourCandidate } from "../types/visit-tour";

interface VisitTourMapPopupProps {
  company: VisitTourCandidate;
  onClose: () => void;
}

export function VisitTourMapPopup({ company, onClose }: VisitTourMapPopupProps) {
  return (
    <div className="absolute right-3 top-3 z-[500] w-[min(100%,280px)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{company.name}</h4>
          <p className="text-xs text-slate-500">
            {company.city || "—"}
            {company.province ? ` (${company.province})` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-600">
        <p>{COMMERCIAL_STATUS_LABELS[company.commercial_status]} · {COMPANY_STATUS_LABELS[company.status]}</p>
        <p>Distanza dal percorso: {formatDistanceKm(company.distanceFromRouteKm)}</p>
        <p>Telefono: {company.phone || "—"}</p>
        <p>Email: {company.email || "—"}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/companies/${company.id}`}
          className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Scheda
        </Link>
        {company.phone && (
          <a
            href={`tel:${company.phone}`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700"
          >
            <Phone className="h-3.5 w-3.5" />
            Chiama
          </a>
        )}
      </div>
    </div>
  );
}
