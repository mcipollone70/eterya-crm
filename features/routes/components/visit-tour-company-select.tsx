"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useVisitTourCompanies } from "./visit-tour-companies-provider";

interface VisitTourCompanySelectProps {
  value: string;
  onChange: (companyId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  pinnedIds?: string[];
  className?: string;
}

export function VisitTourCompanySelect({
  value,
  onChange,
  placeholder = "Seleziona azienda",
  disabled = false,
  pinnedIds = [],
  className,
}: VisitTourCompanySelectProps) {
  const { companies, companyById, isLoading, loadByIds, searchCompanies } =
    useVisitTourCompanies();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, startSearchTransition] = useTransition();

  useEffect(() => {
    const ids = [value, ...pinnedIds].filter(Boolean);
    if (ids.length > 0) {
      void loadByIds(ids);
    }
  }, [loadByIds, pinnedIds, value]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      return;
    }

    const timer = setTimeout(() => {
      startSearchTransition(async () => {
        await searchCompanies(trimmed);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchCompanies, searchQuery]);

  const optionMap = new Map(companies.map((company) => [company.id, company]));
  for (const id of [value, ...pinnedIds]) {
    if (!id || optionMap.has(id)) {
      continue;
    }
    const company = companyById.get(id);
    if (company) {
      optionMap.set(id, company);
    }
  }

  const options = Array.from(optionMap.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "it")
  );

  return (
    <div className={className}>
      <input
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        disabled={disabled}
        className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        placeholder="Cerca azienda per nome…"
      />
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">{placeholder}</option>
          {options.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
              {company.city ? ` · ${company.city}` : ""}
            </option>
          ))}
        </select>
        {(isLoading || isSearching) && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>
      {options.length === 0 && !isLoading && (
        <p className="mt-1 text-xs text-slate-500">
          Sposta la mappa sull&apos;area di interesse o cerca per nome.
        </p>
      )}
    </div>
  );
}
