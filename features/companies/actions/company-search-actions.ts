"use server";

import {
  getCompanySelectOptionsByIds,
  searchCompanySelectOptions,
  type CompanySelectOption,
} from "../services/company-search.service";

export async function searchCompanySelectOptionsAction(
  query: string
): Promise<{ data: CompanySelectOption[]; error: string | null }> {
  return searchCompanySelectOptions(query);
}

export async function getCompanySelectOptionsByIdsAction(
  ids: string[]
): Promise<{ data: CompanySelectOption[]; error: string | null }> {
  return getCompanySelectOptionsByIds(ids);
}
