"use client";

import Link from "next/link";
import { Phone } from "lucide-react";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { COMPANY_STATUS_LABELS } from "@/features/companies/utils/company-fields";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import { PRIORITY_TIER_LABELS } from "@/lib/constants/priority-tier";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import type { VisitTourCandidate, VisitTourSortKey } from "../types/visit-tour";

interface VisitTourCandidatesListProps {
  candidates: VisitTourCandidate[];
  selectedIds: Set<string>;
  sortKey: VisitTourSortKey;
  onSortChange: (sortKey: VisitTourSortKey) => void;
  onToggleCompany: (companyId: string) => void;
}

const SORT_OPTIONS: Array<{ value: VisitTourSortKey; label: string }> = [
  { value: "distance", label: "Distanza" },
  { value: "priority", label: "Priorità" },
  { value: "lastVisit", label: "Ultima visita" },
  { value: "potential", label: "Potenziale" },
];

function formatLastVisit(value: string | null): string {
  if (!value) {
    return "Mai visitata";
  }

  return new Date(value).toLocaleDateString("it-IT");
}

function formatNextActivity(value: string | null): string {
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

export function VisitTourCandidatesList({
  candidates,
  selectedIds,
  sortKey,
  onSortChange,
  onToggleCompany,
}: VisitTourCandidatesListProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Aziende lungo il percorso ({candidates.length})
        </h3>
        <label className="text-xs text-slate-600">
          Ordina per{" "}
          <select
            value={sortKey}
            onChange={(event) => onSortChange(event.target.value as VisitTourSortKey)}
            className="rounded border border-slate-200 px-2 py-1 text-xs"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-lg border border-slate-100">
        {candidates.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            Nessuna azienda entro 2 km dal percorso.
          </p>
        ) : (
          candidates.map((company) => {
            const isSelected = selectedIds.has(company.id);

            return (
              <article
                key={company.id}
                className={`space-y-2 border-b border-slate-100 p-3 last:border-0 ${
                  isSelected ? "bg-indigo-50" : "bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{company.name}</p>
                    <p className="text-xs text-slate-500">
                      {company.city || "—"}
                      {company.province ? ` (${company.province})` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {formatDistanceKm(company.distanceFromRouteKm)} · {company.distanceBand}
                  </span>
                </div>

                <div className="grid gap-1 text-xs text-slate-600">
                  <p>
                    {COMMERCIAL_STATUS_LABELS[company.commercial_status]} ·{" "}
                    {COMPANY_STATUS_LABELS[company.status]}
                  </p>
                  <p>
                    {company.address || "—"} · {company.city || "—"}
                    {company.province ? ` (${company.province})` : ""}
                  </p>
                  <p>
                    Priorità: {company.priorityScore} · {PRIORITY_TIER_LABELS[company.priorityTier]}
                  </p>
                  <p>Ultima visita: {formatLastVisit(company.lastVisitAt)}</p>
                  <p>Prossima attività: {formatNextActivity(company.nextActivityAt)}</p>
                  <p>Telefono: {company.phone || "—"}</p>
                  <p>Email: {company.email || "—"}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleCompany(company.id)}
                    className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium ${
                      isSelected
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    {isSelected ? "Nel giro" : "Aggiungi al giro"}
                  </button>
                  {company.phone && (
                    <a
                      href={`tel:${company.phone}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Chiama
                    </a>
                  )}
                  <Link
                    href={`/companies/${company.id}`}
                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Scheda
                  </Link>
                  <Link
                    href={companyRegisterVisitHref(company.id)}
                    className="inline-flex h-8 items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    Visita
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
