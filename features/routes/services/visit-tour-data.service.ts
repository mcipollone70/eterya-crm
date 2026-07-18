import "server-only";

import { normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import { resolveCompanyDisplayFields } from "@/features/companies/services/companies.service";
import {
  COMPANY_SEARCH_MIN_LENGTH,
  COMPANY_SEARCH_TEXT_FIELDS,
} from "@/features/companies/constants/company-search";
import { escapeIlikePattern } from "@/features/search/utils/escape-ilike";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { CommercialStatus, CompanyStatus, Json } from "@/lib/supabase/types";
import {
  VISIT_TOUR_FETCH_PAGE_SIZE,
  VISIT_TOUR_MAX_FETCH_PER_BOUNDS,
  VISIT_TOUR_SEARCH_LIMIT,
} from "../constants/visit-tour-fetch";
import type {
  VisitTourCompaniesFetchResult,
  VisitTourCompany,
  VisitTourGeoBounds,
} from "../types/visit-tour";

const TOUR_COMPANY_COLUMNS =
  "id,name,address,city,province,latitude,longitude,commercial_status,status,revenue,last_visit_at,phone,email,contact_email,contact_phone,mobile,phone_secondary,import_headers,import_payload";

type TourCompanyRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  commercial_status: CommercialStatus | null;
  status: CompanyStatus;
  revenue: number | null;
  last_visit_at: string | null;
  phone: string | null;
  email: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  mobile: string | null;
  phone_secondary: string | null;
  import_headers: string[] | null;
  import_payload: Json | null;
};

function buildTextOrFilter(fields: readonly string[], pattern: string): string {
  return fields.map((field) => `${field}.ilike.${pattern}`).join(",");
}

function mapTourCompany(row: TourCompanyRow): VisitTourCompany | null {
  if (row.latitude === null || row.longitude === null) {
    return null;
  }

  const display = resolveCompanyDisplayFields({
    id: row.id,
    name: row.name,
    city: row.city,
    province: row.province,
    vat_number: null,
    phone: row.phone,
    email: row.email ?? row.contact_email,
    contact_phone: row.contact_phone,
    mobile: row.mobile,
    phone_secondary: row.phone_secondary,
    status: "prospect",
    geocode_status: "completed",
    created_at: "",
    import_headers: row.import_headers,
    import_payload: row.import_payload,
  });

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    province: row.province,
    address: row.address,
    phone: display.phone,
    email: display.email,
    commercial_status: normalizeCommercialStatus(row.commercial_status),
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    revenue: row.revenue,
    lastVisitAt: row.last_visit_at,
    nextActivityAt: null,
    import_payload: row.import_payload,
  };
}

function mapTourCompanies(rows: TourCompanyRow[]): VisitTourCompany[] {
  return rows
    .map((row) => mapTourCompany(row))
    .filter((company): company is VisitTourCompany => company !== null);
}

export async function getVisitTourCompaniesInBounds(
  bounds: VisitTourGeoBounds,
  offset = 0
): Promise<VisitTourCompaniesFetchResult> {
  const supabase = await createServerClient();
  const safeOffset = Math.max(0, offset);

  if (safeOffset >= VISIT_TOUR_MAX_FETCH_PER_BOUNDS) {
    return { data: [], error: null, hasMore: false, loadedCount: 0 };
  }

  const pageSize = Math.min(
    VISIT_TOUR_FETCH_PAGE_SIZE,
    VISIT_TOUR_MAX_FETCH_PER_BOUNDS - safeOffset
  );

  const query = supabase
    .from("companies")
    .select(TOUR_COMPANY_COLUMNS)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", bounds.south)
    .lte("latitude", bounds.north)
    .gte("longitude", bounds.west)
    .lte("longitude", bounds.east);

  const { data, error } = await query
    .order("name", { ascending: true })
    .range(safeOffset, safeOffset + pageSize - 1);

  if (error) {
    return { data: [], error: describeDbError(error), hasMore: false, loadedCount: 0 };
  }

  const companies = mapTourCompanies((data ?? []) as TourCompanyRow[]);

  return {
    data: companies,
    error: null,
    hasMore: companies.length === pageSize,
    loadedCount: companies.length,
  };
}

export async function getVisitTourCompaniesByIds(ids: string[]): Promise<{
  data: VisitTourCompany[];
  error: string | null;
}> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { data: [], error: null };
  }

  const supabase = await createServerClient();
  const companies: VisitTourCompany[] = [];
  const chunkSize = 100;

  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("companies")
      .select(TOUR_COMPANY_COLUMNS)
      .in("id", chunk)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (error) {
      return { data: [], error: describeDbError(error) };
    }

    companies.push(...mapTourCompanies((data ?? []) as TourCompanyRow[]));
  }

  return { data: companies, error: null };
}

export async function searchVisitTourCompanies(
  queryText: string,
  bounds: VisitTourGeoBounds | null = null,
  limit = VISIT_TOUR_SEARCH_LIMIT
): Promise<{ data: VisitTourCompany[]; error: string | null }> {
  const trimmed = queryText.trim();
  if (trimmed.length < COMPANY_SEARCH_MIN_LENGTH) {
    return { data: [], error: null };
  }

  const pattern = escapeIlikePattern(trimmed);
  if (!pattern) {
    return { data: [], error: null };
  }

  const supabase = await createServerClient();
  let query = supabase
    .from("companies")
    .select(TOUR_COMPANY_COLUMNS)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .or(buildTextOrFilter(COMPANY_SEARCH_TEXT_FIELDS, pattern))
    .order("name", { ascending: true })
    .limit(limit);

  if (bounds) {
    query = query
      .gte("latitude", bounds.south)
      .lte("latitude", bounds.north)
      .gte("longitude", bounds.west)
      .lte("longitude", bounds.east);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return { data: mapTourCompanies((data ?? []) as TourCompanyRow[]), error: null };
}

/** @deprecated Usare getVisitTourCompaniesInBounds o getVisitTourCompaniesByIds. */
export async function getVisitTourCompanies(): Promise<{
  data: VisitTourCompany[];
  error: string | null;
}> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("companies")
    .select(TOUR_COMPANY_COLUMNS)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("name", { ascending: true })
    .limit(VISIT_TOUR_FETCH_PAGE_SIZE);

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return { data: mapTourCompanies((data ?? []) as TourCompanyRow[]), error: null };
}
