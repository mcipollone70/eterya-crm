"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, MapPin, Navigation } from "lucide-react";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { NEARBY_RADIUS_OPTIONS_KM } from "../constants/map-config";
import type { MapCompany, NearbyFiltersState, UserLocation } from "../types/map";
import { DEFAULT_NEARBY_FILTERS, type NearbyCommercialStatusFilter } from "../types/map";
import { formatDistanceKm } from "../utils/geo-distance";
import { buildGoogleMapsDirectionsUrl, getCitiesForProvince } from "../utils/map-filters";
import { findNearbyCompanies } from "../utils/nearby-companies";

interface NearbyCompaniesPanelProps {
  companies: MapCompany[];
  provinces: string[];
  userLocation: UserLocation | null;
  isLocating: boolean;
  locationError: string | null;
  onRequestLocation: () => void;
}

const STATUS_FILTER_OPTIONS: NearbyCommercialStatusFilter[] = [
  "prospect",
  "cliente",
  "da_ricontattare",
];

export function NearbyCompaniesPanel({
  companies,
  provinces,
  userLocation,
  isLocating,
  locationError,
  onRequestLocation,
}: NearbyCompaniesPanelProps) {
  const [filters, setFilters] = useState<NearbyFiltersState>(DEFAULT_NEARBY_FILTERS);

  const cityOptions = getCitiesForProvince(companies, filters.province);

  const nearbyCompanies = useMemo(() => {
    if (!userLocation) {
      return [];
    }

    return findNearbyCompanies(companies, userLocation, filters);
  }, [companies, filters, userLocation]);

  function toggleCommercialStatus(status: NearbyCommercialStatusFilter) {
    setFilters((current) => {
      const selected = new Set(current.commercialStatuses);
      if (selected.has(status)) {
        selected.delete(status);
      } else {
        selected.add(status);
      }

      return {
        ...current,
        commercialStatuses: STATUS_FILTER_OPTIONS.filter((value) => selected.has(value)),
      };
    });
  }

  return (
    <aside className="flex max-h-[420px] w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:w-72 lg:shrink-0 lg:max-h-none lg:flex-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Aziende vicine</h3>
          <p className="mt-1 text-xs text-slate-500">
            {userLocation
              ? `${nearbyCompanies.length.toLocaleString("it-IT")} risultati nel raggio selezionato`
              : "Usa la posizione corrente per cercare"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestLocation}
          disabled={isLocating}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="Aggiorna posizione"
        >
          {isLocating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Navigation className="h-3.5 w-3.5" />
          )}
          Posizione
        </button>
      </div>

      {locationError && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {locationError}
        </p>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Raggio</span>
        <select
          value={filters.radiusKm}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              radiusKm: Number(event.target.value) as NearbyFiltersState["radiusKm"],
            }))
          }
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          disabled={!userLocation}
        >
          {NEARBY_RADIUS_OPTIONS_KM.map((radius) => (
            <option key={radius} value={radius}>
              {radius} km
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Stato commerciale</legend>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTER_OPTIONS.map((status) => (
            <label
              key={status}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700"
            >
              <input
                type="checkbox"
                checked={filters.commercialStatuses.includes(status)}
                onChange={() => toggleCommercialStatus(status)}
                className="rounded border-slate-300"
              />
              {COMMERCIAL_STATUS_LABELS[status]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Provincia</span>
        <select
          value={filters.province}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              province: event.target.value,
              city: "",
            }))
          }
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          disabled={!userLocation}
        >
          <option value="">Tutte</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Comune</span>
        <select
          value={filters.city}
          onChange={(event) =>
            setFilters((current) => ({ ...current, city: event.target.value }))
          }
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          disabled={!userLocation || cityOptions.length === 0}
        >
          <option value="">Tutti</option>
          {cityOptions.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-100">
        {!userLocation ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-500">
            <MapPin className="h-5 w-5 text-slate-400" />
            <p>Consenti la geolocalizzazione o premi “Vai alla mia posizione”.</p>
          </div>
        ) : nearbyCompanies.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            Nessuna azienda nel raggio selezionato.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {nearbyCompanies.map((company) => (
              <li key={company.id} className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{company.name}</p>
                  <span className="shrink-0 text-xs font-medium text-indigo-600">
                    {formatDistanceKm(company.distanceKm)}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {company.city || "—"}
                  {company.province ? ` (${company.province})` : ""}
                </p>
                <p className="text-xs text-slate-600">{company.phone || "—"}</p>
                <p className="text-xs text-slate-500">
                  {COMMERCIAL_STATUS_LABELS[company.commercial_status]}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/companies/${company.id}`}
                    className="inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Apri scheda
                  </Link>
                  <a
                    href={buildGoogleMapsDirectionsUrl(company.latitude, company.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Naviga
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
