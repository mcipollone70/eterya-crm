import "server-only";

import {
  COMPANY_SEARCH_MIN_LENGTH,
  COMPANY_SEARCH_RESULT_LIMIT,
  COMPANY_SEARCH_TEXT_FIELDS,
} from "../constants/company-search";
import { escapeIlikePattern } from "@/features/search/utils/escape-ilike";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";

export interface CompanySelectOption {
  id: string;
  name: string;
  city: string | null;
  vatNumber: string | null;
}

const COMPANY_SELECT_COLUMNS = "id,name,city,vat_number";

function buildTextOrFilter(fields: readonly string[], pattern: string): string {
  return fields.map((field) => `${field}.ilike.${pattern}`).join(",");
}

function mapCompanySelectOption(row: {
  id: string;
  name: string;
  city: string | null;
  vat_number: string | null;
}): CompanySelectOption {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    vatNumber: row.vat_number,
  };
}

export async function searchCompanySelectOptions(
  queryText: string,
  limit = COMPANY_SEARCH_RESULT_LIMIT
): Promise<{ data: CompanySelectOption[]; error: string | null }> {
  const trimmed = queryText.trim();
  if (trimmed.length < COMPANY_SEARCH_MIN_LENGTH) {
    return { data: [], error: null };
  }

  const pattern = escapeIlikePattern(trimmed);
  if (!pattern) {
    return { data: [], error: null };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_SELECT_COLUMNS)
    .or(buildTextOrFilter(COMPANY_SEARCH_TEXT_FIELDS, pattern))
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return {
    data: (data ?? []).map((row) =>
      mapCompanySelectOption(row as { id: string; name: string; city: string | null; vat_number: string | null })
    ),
    error: null,
  };
}

export async function getCompanySelectOptionsByIds(
  ids: string[]
): Promise<{ data: CompanySelectOption[]; error: string | null }> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { data: [], error: null };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_SELECT_COLUMNS)
    .in("id", uniqueIds)
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return {
    data: (data ?? []).map((row) =>
      mapCompanySelectOption(row as { id: string; name: string; city: string | null; vat_number: string | null })
    ),
    error: null,
  };
}
