"use client";

import { COMMERCIAL_STATUS_OPTIONS } from "@/lib/constants/commercial-status";
import type { MapCompany } from "../types/map";
import { DEFAULT_MAP_FILTERS, type MapFiltersState } from "../types/map";
import { getCitiesForProvince } from "../utils/map-filters";

interface MapSidebarFiltersProps {
  companies: MapCompany[];
  provinces: string[];
  filters: MapFiltersState;
  visibleCount: number;
  onChange: (filters: MapFiltersState) => void;
  onGoToMyLocation: () => void;
}

export function MapSidebarFilters({
  companies,
  provinces,
  filters,
  visibleCount,
  onChange,
  onGoToMyLocation,
}: MapSidebarFiltersProps) {
  const cityOptions = getCitiesForProvince(
    companies,
    filters.province
  );

  function updateFilters(partial: Partial<MapFiltersState>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <aside className="flex h-full w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:w-72 lg:shrink-0">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Filtri mappa</h3>
        <p className="mt-1 text-xs text-slate-500">
          {visibleCount.toLocaleString("it-IT")} aziende visibili
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Stato commerciale</span>
        <select
          value={filters.commercialStatus}
          onChange={(event) =>
            updateFilters({
              commercialStatus: event.target.value as MapFiltersState["commercialStatus"],
            })
          }
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        >
          <option value="">Tutti</option>
          {COMMERCIAL_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Provincia</span>
        <select
          value={filters.province}
          onChange={(event) =>
            updateFilters({
              province: event.target.value,
              city: "",
            })
          }
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
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
          onChange={(event) => updateFilters({ city: event.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          disabled={cityOptions.length === 0}
        >
          <option value="">Tutti</option>
          {cityOptions.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={filters.geolocatedOnly}
          onChange={(event) => updateFilters({ geolocatedOnly: event.target.checked })}
          className="rounded border-slate-300"
        />
        Solo geolocalizzate
      </label>

      <button
        type="button"
        onClick={onGoToMyLocation}
        className="mt-auto inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Vai alla mia posizione
      </button>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_MAP_FILTERS)}
        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Reimposta filtri
      </button>
    </aside>
  );
}
