import "server-only";

import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { escapeIlikePattern } from "@/features/search/utils/escape-ilike";
import { createServerClient } from "@/lib/supabase/server";
import type { CommercialStatus } from "@/lib/supabase/types";
import { describeDbError } from "@/lib/supabase/errors";
import {
  emptyToolResult,
  isMissingTableError,
  successToolResult,
  type JoyToolResult,
} from "./types";

export interface JoyCompanyRecord {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  phone: string | null;
  contact_phone: string | null;
  mobile: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  last_visit_at: string | null;
  commercial_status: CommercialStatus | null;
}

const COMPANY_SELECT =
  "id,name,city,province,phone,contact_phone,mobile,email,latitude,longitude,last_visit_at,commercial_status";

export interface SearchCompaniesOptions {
  city?: string | null;
  query?: string | null;
  commercialStatus?: CommercialStatus | null;
  userId?: string | null;
  limit?: number;
}

export async function getCompanies(options: {
  userId?: string | null;
  limit?: number;
} = {}): Promise<JoyToolResult<{ rows: JoyCompanyRecord[]; total: number }>> {
  const limit = options.limit ?? 12;
  const supabase = await createServerClient();

  let query = supabase
    .from("companies")
    .select(COMPANY_SELECT, { count: "exact" })
    .order("name", { ascending: true })
    .limit(limit);

  if (options.userId) {
    query = applyAgentCompanyScope(query, options.userId);
  }

  const { data, count, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return emptyToolResult({ rows: [], total: 0 });
    }
    return emptyToolResult({ rows: [], total: 0 }, describeDbError(error));
  }

  const rows = (data ?? []) as JoyCompanyRecord[];
  return successToolResult({ rows, total: count ?? rows.length });
}

export async function getCompanyById(
  companyId: string
): Promise<JoyToolResult<JoyCompanyRecord | null>> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return emptyToolResult(null);
    }
    return emptyToolResult(null, describeDbError(error));
  }

  if (!data) {
    return emptyToolResult(null);
  }

  return successToolResult(data as JoyCompanyRecord);
}

/** Allinea Joy al filtro elenco aziende: null legacy = prospect. */
function applyCommercialStatusFilter<
  T extends { eq: (column: string, value: string) => T; or: (filters: string) => T },
>(query: T, commercialStatus: CommercialStatus): T {
  if (commercialStatus === "prospect") {
    return query.or("commercial_status.eq.prospect,commercial_status.is.null");
  }
  return query.eq("commercial_status", commercialStatus);
}

/**
 * Cerca aziende CRM reali. Errori Supabase → hasData=false + error (mai zero finti).
 * City: ilike case-insensitive (Latina / latina / Comune di Latina).
 * Non richiede coordinate.
 */
export async function searchCompanies(
  options: SearchCompaniesOptions
): Promise<JoyToolResult<{ rows: JoyCompanyRecord[]; total: number }>> {
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 50);
  const supabase = await createServerClient();

  let query = supabase
    .from("companies")
    .select(COMPANY_SELECT, { count: "exact" })
    .order("last_visit_at", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true })
    .limit(limit);

  // Ricerca per comune: allinea all'elenco Aziende (no assigned_user_id), altrimenti zero finti.
  if (options.userId && !options.city) {
    query = applyAgentCompanyScope(query, options.userId);
  }

  if (options.commercialStatus) {
    query = applyCommercialStatusFilter(query, options.commercialStatus);
  }

  if (options.city) {
    const pattern = escapeIlikePattern(options.city.trim());
    if (pattern) {
      query = query.ilike("city", pattern);
    }
  }

  if (options.query) {
    const pattern = escapeIlikePattern(options.query);
    if (pattern) {
      query = query.ilike("name", pattern);
    }
  }

  const { data, count, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return emptyToolResult({ rows: [], total: 0 }, describeDbError(error));
    }
    return emptyToolResult({ rows: [], total: 0 }, describeDbError(error));
  }

  const rows = (data ?? []) as JoyCompanyRecord[];
  return successToolResult({ rows, total: count ?? rows.length });
}
