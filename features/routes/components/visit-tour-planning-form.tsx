"use client";

import { useEffect, useState } from "react";
import type { CommercialStatus, CompanyStatus } from "@/lib/supabase/types";
import { COMMERCIAL_STATUS_OPTIONS } from "@/lib/constants/commercial-status";
import { COMPANY_STATUS_OPTIONS } from "@/features/companies/utils/company-fields";
import { fetchAgendaAppointmentsForTourAction } from "../actions/fetch-agenda-appointments";
import {
  VISIT_TOUR_CORRIDOR_RADIUS_OPTIONS,
  VISIT_TOUR_VISIT_DURATION_OPTIONS,
} from "../constants/visit-tour-status";
import type {
  VisitTourAgendaOption,
  VisitTourDestinationType,
  VisitTourOriginType,
  VisitTourPlannerFormState,
} from "../types/visit-tour";
import { VisitTourCompanySelect } from "./visit-tour-company-select";

export const DEFAULT_PLANNER_FORM: VisitTourPlannerFormState = {
  tourDate: new Date().toISOString().slice(0, 10),
  departureTime: "08:30",
  maxArrivalTime: "18:00",
  corridorRadiusKm: 5,
  visitDurationMin: 30,
  filters: {
    commercialStatus: "",
    companyStatus: "",
    province: "",
    municipality: "",
  },
};

interface VisitTourPlanningFormProps {
  originType: VisitTourOriginType;
  destinationType: VisitTourDestinationType;
  originCompanyId: string;
  destinationCompanyId: string;
  selectedAgendaId: string;
  originAddressInput: string;
  destinationAddressInput: string;
  form: VisitTourPlannerFormState;
  onOriginTypeChange: (value: VisitTourOriginType) => void;
  onDestinationTypeChange: (value: VisitTourDestinationType) => void;
  onOriginCompanyIdChange: (value: string) => void;
  onDestinationCompanyIdChange: (value: string) => void;
  onSelectedAgendaIdChange: (value: string) => void;
  onOriginAddressInputChange: (value: string) => void;
  onDestinationAddressInputChange: (value: string) => void;
  onFormChange: (value: VisitTourPlannerFormState) => void;
  onGeocodeOrigin: () => void;
  onGeocodeDestination: () => void;
  onCalculateRoute: () => void;
  isPending: boolean;
  originLabel?: string | null;
  destinationLabel?: string | null;
}

export function VisitTourPlanningForm({
  originType,
  destinationType,
  originCompanyId,
  destinationCompanyId,
  selectedAgendaId,
  originAddressInput,
  destinationAddressInput,
  form,
  onOriginTypeChange,
  onDestinationTypeChange,
  onOriginCompanyIdChange,
  onDestinationCompanyIdChange,
  onSelectedAgendaIdChange,
  onOriginAddressInputChange,
  onDestinationAddressInputChange,
  onFormChange,
  onGeocodeOrigin,
  onGeocodeDestination,
  onCalculateRoute,
  isPending,
  originLabel,
  destinationLabel,
}: VisitTourPlanningFormProps) {
  const [agendaOptions, setAgendaOptions] = useState<VisitTourAgendaOption[]>([]);
  const [agendaError, setAgendaError] = useState<string | null>(null);

  useEffect(() => {
    if (destinationType !== "agenda") {
      return;
    }

    let cancelled = false;
    void fetchAgendaAppointmentsForTourAction(form.tourDate).then((result) => {
      if (cancelled) {
        return;
      }
      setAgendaOptions(result.data);
      setAgendaError(result.error);
    });

    return () => {
      cancelled = true;
    };
  }, [destinationType, form.tourDate]);

  const updateForm = (patch: Partial<VisitTourPlannerFormState>) => {
    onFormChange({ ...form, ...patch });
  };

  return (
    <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Pianifica giro</h3>
        <p className="mt-1 text-xs text-slate-500">
          Imposta partenza, destinazione e filtri per trovare aziende lungo il tragitto.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          Data giro
          <input
            type="date"
            value={form.tourDate}
            onChange={(event) => updateForm({ tourDate: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Raggio corridoio
          <select
            value={form.corridorRadiusKm}
            onChange={(event) =>
              updateForm({ corridorRadiusKm: Number(event.target.value) })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {VISIT_TOUR_CORRIDOR_RADIUS_OPTIONS.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Orario partenza
          <input
            type="time"
            value={form.departureTime}
            onChange={(event) => updateForm({ departureTime: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Arrivo massimo
          <input
            type="time"
            value={form.maxArrivalTime}
            onChange={(event) => updateForm({ maxArrivalTime: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-700">Partenza</p>
          <div className="flex flex-wrap gap-2">
            {(["current", "company", "address"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onOriginTypeChange(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  originType === value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {value === "current"
                  ? "Posizione attuale"
                  : value === "company"
                    ? "Azienda"
                    : "Indirizzo"}
              </button>
            ))}
          </div>
        </div>

        {originType === "company" && (
          <VisitTourCompanySelect
            value={originCompanyId}
            onChange={onOriginCompanyIdChange}
            placeholder="Seleziona partenza"
            pinnedIds={originCompanyId ? [originCompanyId] : []}
          />
        )}

        {originType === "address" && (
          <div className="space-y-2">
            <input
              type="text"
              value={originAddressInput}
              onChange={(event) => onOriginAddressInputChange(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Indirizzo di partenza"
            />
            <button
              type="button"
              onClick={onGeocodeOrigin}
              disabled={isPending || !originAddressInput.trim()}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Geocodifica partenza
            </button>
          </div>
        )}

        {originLabel && (
          <p className="text-xs text-emerald-700">Partenza: {originLabel}</p>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-700">Destinazione</p>
          <div className="flex flex-wrap gap-2">
            {(["company", "address", "agenda"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onDestinationTypeChange(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  destinationType === value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {value === "company"
                  ? "Azienda"
                  : value === "address"
                    ? "Indirizzo"
                    : "Agenda"}
              </button>
            ))}
          </div>
        </div>

        {destinationType === "company" && (
          <VisitTourCompanySelect
            value={destinationCompanyId}
            onChange={onDestinationCompanyIdChange}
            placeholder="Seleziona destinazione"
            pinnedIds={destinationCompanyId ? [destinationCompanyId] : []}
          />
        )}

        {destinationType === "address" && (
          <div className="space-y-2">
            <input
              type="text"
              value={destinationAddressInput}
              onChange={(event) => onDestinationAddressInputChange(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Via, civico, comune, provincia"
            />
            <button
              type="button"
              onClick={onGeocodeDestination}
              disabled={isPending || !destinationAddressInput.trim()}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Geocodifica destinazione
            </button>
          </div>
        )}

        {destinationType === "agenda" && (
          <div className="space-y-2">
            <select
              value={selectedAgendaId}
              onChange={(event) => onSelectedAgendaIdChange(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Seleziona appuntamento agenda</option>
              {agendaOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {option.lat == null ? " (non geolocalizzata)" : ""}
                </option>
              ))}
            </select>
            {agendaError && (
              <p className="text-xs text-rose-700">{agendaError}</p>
            )}
            {agendaOptions.length === 0 && !agendaError && (
              <p className="text-xs text-slate-500">
                Nessun appuntamento aperto per la data selezionata.
              </p>
            )}
          </div>
        )}

        {destinationLabel && (
          <p className="text-xs text-emerald-700">Destinazione: {destinationLabel}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          Stato commerciale
          <select
            value={form.filters.commercialStatus}
            onChange={(event) =>
              updateForm({
                filters: {
                  ...form.filters,
                  commercialStatus: event.target.value as CommercialStatus | "",
                },
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tutti</option>
            {COMMERCIAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Tipo azienda
          <select
            value={form.filters.companyStatus}
            onChange={(event) =>
              updateForm({
                filters: {
                  ...form.filters,
                  companyStatus: event.target.value as CompanyStatus | "",
                },
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tutti</option>
            {COMPANY_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Provincia
          <input
            type="text"
            value={form.filters.province}
            onChange={(event) =>
              updateForm({
                filters: { ...form.filters, province: event.target.value.toUpperCase() },
              })
            }
            maxLength={2}
            placeholder="Es. MI"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
          />
        </label>
        <label className="text-xs text-slate-600">
          Comune
          <input
            type="text"
            value={form.filters.municipality}
            onChange={(event) =>
              updateForm({
                filters: { ...form.filters, municipality: event.target.value },
              })
            }
            placeholder="Filtra per comune"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600 sm:col-span-2">
          Durata media visita
          <select
            value={form.visitDurationMin}
            onChange={(event) =>
              updateForm({ visitDurationMin: Number(event.target.value) })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {VISIT_TOUR_VISIT_DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={onCalculateRoute}
        disabled={isPending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300"
      >
        Calcola percorso
      </button>
    </aside>
  );
}
