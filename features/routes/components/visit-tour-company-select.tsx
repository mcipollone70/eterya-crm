"use client";

import { useCallback } from "react";
import {
  CompanySelect,
  type CompanySelectOption,
  type CompanySelectSearchResult,
} from "@/features/companies/components/company-select";
import {
  fetchVisitTourCompaniesByIdsAction,
  searchVisitTourCompaniesAction,
} from "../actions/visit-tour-actions";
import type { VisitTourCompany } from "../types/visit-tour";

interface VisitTourCompanySelectProps {
  value: string;
  onChange: (companyId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  pinnedIds?: string[];
  className?: string;
}

function mapVisitTourCompany(company: VisitTourCompany): CompanySelectOption {
  return {
    id: company.id,
    name: company.name,
    city: company.city,
    vatNumber: null,
  };
}

export function VisitTourCompanySelect({
  value,
  onChange,
  placeholder = "Seleziona azienda",
  disabled = false,
  pinnedIds = [],
  className,
}: VisitTourCompanySelectProps) {
  const onSearch = useCallback(async (query: string): Promise<CompanySelectSearchResult> => {
    const result = await searchVisitTourCompaniesAction(query);
    if (result.error) {
      return { data: [], error: result.error };
    }
    return {
      data: result.data.map(mapVisitTourCompany),
      error: null,
    };
  }, []);

  const resolveByIds = useCallback(async (ids: string[]): Promise<CompanySelectSearchResult> => {
    const result = await fetchVisitTourCompaniesByIdsAction(ids);
    if (result.error) {
      return { data: [], error: result.error };
    }
    return {
      data: result.data.map(mapVisitTourCompany),
      error: null,
    };
  }, []);

  return (
    <CompanySelect
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      emptyLabel={placeholder}
      allowEmpty
      disabled={disabled}
      pinnedIds={pinnedIds}
      className={className}
      onSearch={onSearch}
      resolveByIds={resolveByIds}
      searchHint="Digita almeno 2 caratteri per cercare aziende geolocalizzate."
    />
  );
}
