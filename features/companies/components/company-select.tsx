"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  getCompanySelectOptionsByIdsAction,
  searchCompanySelectOptionsAction,
} from "../actions/company-search-actions";
import { COMPANY_SEARCH_MIN_LENGTH } from "../constants/company-search";
import type { CompanySelectOption } from "../services/company-search.service";

export type { CompanySelectOption };

export interface CompanySelectSearchResult {
  data: CompanySelectOption[];
  error: string | null;
}

interface CompanySelectProps {
  value: string;
  onChange: (companyId: string) => void;
  onCompanyChange?: (company: CompanySelectOption | null) => void;
  name?: string;
  placeholder?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  searchPlaceholder?: string;
  searchHint?: string;
  pinnedIds?: string[];
  onSearch?: (query: string) => Promise<CompanySelectSearchResult>;
  resolveByIds?: (ids: string[]) => Promise<CompanySelectSearchResult>;
}

function formatCompanyLabel(company: CompanySelectOption): string {
  const parts = [company.name];
  if (company.city) {
    parts.push(company.city);
  }
  if (company.vatNumber) {
    parts.push(`P.IVA ${company.vatNumber}`);
  }
  return parts.join(" · ");
}

function mergeOptions(
  ...groups: Array<CompanySelectOption[] | undefined>
): CompanySelectOption[] {
  const optionMap = new Map<string, CompanySelectOption>();
  for (const group of groups) {
    for (const option of group ?? []) {
      optionMap.set(option.id, option);
    }
  }
  return Array.from(optionMap.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "it")
  );
}

export function CompanySelect({
  value,
  onChange,
  onCompanyChange,
  name,
  placeholder = "Seleziona azienda",
  emptyLabel = "Seleziona azienda",
  allowEmpty = true,
  required = false,
  disabled = false,
  className,
  selectClassName,
  searchPlaceholder = "Cerca per nome, comune, P.IVA, telefono o email…",
  searchHint = "Digita almeno 2 caratteri per cercare tra tutte le aziende.",
  pinnedIds = [],
  onSearch,
  resolveByIds,
}: CompanySelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CompanySelectOption[]>([]);
  const [resolvedOptions, setResolvedOptions] = useState<CompanySelectOption[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [isResolving, startResolveTransition] = useTransition();

  const resolveIds = useMemo(
    () => [...new Set([value, ...pinnedIds].filter(Boolean))],
    [pinnedIds, value]
  );
  const resolveIdsKey = resolveIds.join("|");

  const runSearch = useCallback(
    async (query: string) => {
      const searchFn = onSearch ?? searchCompanySelectOptionsAction;
      return searchFn(query);
    },
    [onSearch]
  );

  const runResolveByIds = useCallback(
    async (ids: string[]) => {
      const resolveFn = resolveByIds ?? getCompanySelectOptionsByIdsAction;
      return resolveFn(ids);
    },
    [resolveByIds]
  );

  useEffect(() => {
    if (!resolveIdsKey) {
      return;
    }

    startResolveTransition(async () => {
      const result = await runResolveByIds(resolveIds);
      if (result.error) {
        setResolveError(result.error);
        return;
      }
      setResolveError(null);
      setResolvedOptions(result.data);
      if (value) {
        const selected =
          result.data.find((company) => company.id === value) ?? null;
        onCompanyChange?.(selected);
      }
    });
  }, [onCompanyChange, resolveIds, resolveIdsKey, runResolveByIds, value]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < COMPANY_SEARCH_MIN_LENGTH) {
      return;
    }

    const timer = setTimeout(() => {
      startSearchTransition(async () => {
        const result = await runSearch(trimmed);
        if (result.error) {
          setSearchError(result.error);
          setSearchResults([]);
          return;
        }
        setSearchError(null);
        setSearchResults(result.data);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [runSearch, searchQuery]);

  const trimmedSearch = searchQuery.trim();
  const isSearchActive = trimmedSearch.length >= COMPANY_SEARCH_MIN_LENGTH;
  const visibleResolvedOptions = useMemo(
    () => (resolveIdsKey ? resolvedOptions : []),
    [resolveIdsKey, resolvedOptions]
  );
  const visibleSearchResults = useMemo(
    () => (isSearchActive ? searchResults : []),
    [isSearchActive, searchResults]
  );

  const options = useMemo(() => {
    if (isSearchActive) {
      return mergeOptions(visibleSearchResults, visibleResolvedOptions);
    }
    return mergeOptions(visibleResolvedOptions);
  }, [isSearchActive, visibleResolvedOptions, visibleSearchResults]);

  function handleSelectChange(nextValue: string) {
    onChange(nextValue);
    const company =
      options.find((item) => item.id === nextValue) ??
      visibleResolvedOptions.find((item) => item.id === nextValue) ??
      null;
    onCompanyChange?.(company);
  }

  const isLoading = isSearching || (Boolean(resolveIdsKey) && isResolving);
  const showNoResults =
    isSearchActive && !isSearching && !searchError && visibleSearchResults.length === 0;
  const showSearchHint = !isSearchActive && options.length === 0 && !isLoading;

  return (
    <div className={className}>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <input
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        disabled={disabled}
        className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        placeholder={searchPlaceholder}
        aria-label="Cerca azienda"
      />

      <div className="relative">
        <select
          value={value}
          onChange={(event) => handleSelectChange(event.target.value)}
          disabled={disabled}
          required={required}
          className={cn(
            "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm",
            selectClassName
          )}
        >
          {allowEmpty ? <option value="">{emptyLabel || placeholder}</option> : null}
          {options.map((company) => (
            <option key={company.id} value={company.id}>
              {formatCompanyLabel(company)}
            </option>
          ))}
        </select>
        {isLoading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : null}
      </div>

      {isSearching ? (
        <p className="mt-1 text-xs text-slate-500">Ricerca in corso…</p>
      ) : null}
      {searchError ? (
        <p className="mt-1 text-xs text-rose-700">Errore di ricerca: {searchError}</p>
      ) : null}
      {resolveError ? (
        <p className="mt-1 text-xs text-rose-700">
          Impossibile caricare l&apos;azienda selezionata: {resolveError}
        </p>
      ) : null}
      {showNoResults ? (
        <p className="mt-1 text-xs text-slate-500">Nessuna azienda trovata per &quot;{trimmedSearch}&quot;.</p>
      ) : null}
      {showSearchHint ? <p className="mt-1 text-xs text-slate-500">{searchHint}</p> : null}
    </div>
  );
}
