"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  DEFAULT_BRAND_MATCH_MODE,
  parseBrandMatchMode,
  parseBrandsUrlParam,
  serializeBrandsUrlParam,
  type BrandMatchMode,
} from "../utils/brand-shared";

export interface BrandFilterOption {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

interface BrandFilterProps {
  brands: BrandFilterOption[];
  /** Path base senza query (default: pathname corrente). */
  basePath?: string;
  /** Query param name (default: brands). */
  paramName?: string;
  /** Mostra toggle OR/AND quando multi-selezione. */
  showMatchMode?: boolean;
  className?: string;
  /** Variante compatta per sidebar mappa (controllata). */
  controlled?: {
    selectedSlugs: string[];
    matchMode?: BrandMatchMode;
    onChange: (selectedSlugs: string[], matchMode: BrandMatchMode) => void;
  };
}

/**
 * Filtro Brand riutilizzabile: Tutti / single / multi / clear / conteggio.
 * Persistenza URL: ?brands=eterya,zanzar [&brand_mode=and]
 */
export function BrandFilter({
  brands,
  basePath,
  paramName = "brands",
  showMatchMode = true,
  className,
  controlled,
}: BrandFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const urlSelected = useMemo(
    () => parseBrandsUrlParam(searchParams.get(paramName)),
    [searchParams, paramName]
  );
  const urlMode = useMemo(
    () => parseBrandMatchMode(searchParams.get("brand_mode")),
    [searchParams]
  );

  const selectedSlugs = controlled?.selectedSlugs ?? urlSelected;
  const matchMode = controlled?.matchMode ?? urlMode;

  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);

  const pushUrl = useCallback(
    (nextSlugs: string[], nextMode: BrandMatchMode) => {
      if (controlled) {
        controlled.onChange(nextSlugs, nextMode);
        return;
      }

      const params = new URLSearchParams(searchParams.toString());
      const serialized = serializeBrandsUrlParam(nextSlugs);
      if (serialized) {
        params.set(paramName, serialized);
      } else {
        params.delete(paramName);
      }

      if (nextMode === "and" && nextSlugs.length > 1) {
        params.set("brand_mode", "and");
      } else {
        params.delete("brand_mode");
      }

      // Reset pagination when brand filter changes; preserve other filters.
      params.delete("page");

      const path = basePath ?? pathname;
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${path}?${query}` : path);
      });
    },
    [controlled, searchParams, paramName, basePath, pathname, router]
  );

  function toggleSlug(slug: string) {
    const next = new Set(selectedSlugs);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    const list = brands
      .map((b) => b.slug)
      .filter((s) => next.has(s));
    // Mantieni anche slug non in catalogo (edge)
    for (const s of next) {
      if (!list.includes(s)) list.push(s);
    }
    pushUrl(list, list.length <= 1 ? DEFAULT_BRAND_MATCH_MODE : matchMode);
  }

  function clearAll() {
    pushUrl([], DEFAULT_BRAND_MATCH_MODE);
    setOpen(false);
  }

  function selectAllNone() {
    clearAll();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const countLabel =
    selectedSlugs.length === 0
      ? "Tutti i brand"
      : selectedSlugs.length === 1
        ? brands.find((b) => b.slug === selectedSlugs[0])?.name ?? selectedSlugs[0]
        : `${selectedSlugs.length} brand`;

  return (
    <div className={className ?? "relative"}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Filtra per brand"
          disabled={pending}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
        >
          <span className="truncate font-medium">{countLabel}</span>
          {selectedSlugs.length > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700">
              {selectedSlugs.length}
            </span>
          )}
        </button>

        {selectedSlugs.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            aria-label="Azzera filtro brand"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" />
            Azzera
          </button>
        )}

        {showMatchMode && selectedSlugs.length > 1 && (
          <div
            className="inline-flex h-9 overflow-hidden rounded-lg border border-slate-200 bg-white text-xs shadow-sm"
            role="group"
            aria-label="Modalità match brand"
          >
            <button
              type="button"
              onClick={() => pushUrl(selectedSlugs, "or")}
              className={`px-2.5 font-medium ${
                matchMode === "or"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Almeno uno
            </button>
            <button
              type="button"
              onClick={() => pushUrl(selectedSlugs, "and")}
              className={`px-2.5 font-medium ${
                matchMode === "and"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Tutti
            </button>
          </div>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          <button
            type="button"
            role="option"
            aria-selected={selectedSlugs.length === 0}
            onClick={selectAllNone}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
              selectedSlugs.length === 0
                ? "bg-indigo-50 font-medium text-indigo-800"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Tutti i brand
          </button>

          <ul className="mt-1 max-h-64 space-y-0.5 overflow-y-auto">
            {brands.map((brand) => {
              const checked = selectedSet.has(brand.slug);
              return (
                <li key={brand.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggleSlug(brand.slug)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                      checked
                        ? "bg-indigo-50 font-medium text-indigo-800"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-slate-200"
                      style={{ backgroundColor: brand.color ?? "#94a3b8" }}
                      aria-hidden
                    />
                    <span className="truncate">{brand.name}</span>
                    <span className="ml-auto font-mono text-[10px] uppercase text-slate-400">
                      {brand.slug}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Alias semantico per multi-select esplicita. */
export const BrandMultiSelect = BrandFilter;
