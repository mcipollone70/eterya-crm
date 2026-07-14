import "server-only";

import { normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { CommercialStatus, GeocodeStatus, Json } from "@/lib/supabase/types";
import { resolveCompanyDisplayFields } from "@/features/companies/services/companies.service";
import { buildFullAddress } from "@/features/companies/utils/build-full-address";
import {
  GEOCODED_MAP_STATUSES,
  MAP_FETCH_PAGE_SIZE,
  MAP_MAX_FETCH_PER_BOUNDS,
  MAP_VIEWPORT_FETCH_PAGE_SIZE,
} from "../constants/map-config";
import type {
  MapCompaniesFetchResult,
  MapCompaniesStats,
  MapCompany,
  MapFiltersState,
  MapGeoBounds,
  MapPageBootstrap,
} from "../types/map";

const MAP_COMPANY_COLUMNS =
  "id,name,city,province,latitude,longitude,commercial_status,geocode_status,address,street,street_number,postal_code,country,phone,contact_phone,mobile,phone_secondary,import_headers,import_payload,geocoding_normalized_address";

type MapCompanyRow = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  commercial_status: CommercialStatus | null;
  geocode_status: GeocodeStatus;
  address: string | null;
  street: string | null;
  street_number: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  contact_phone: string | null;
  mobile: string | null;
  phone_secondary: string | null;
  import_headers: string[] | null;
  import_payload: Json | null;
  geocoding_normalized_address: string | null;
};

const EMPTY_MAP_STATS: MapCompaniesStats = {
  totalWithCoordinates: 0,
  totalGeocodedConfirmed: 0,
  loadedCount: 0,
  isTruncated: false,
};

function mapMapCompany(row: MapCompanyRow): MapCompany | null {
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
    email: null,
    contact_phone: row.contact_phone,
    mobile: row.mobile,
    phone_secondary: row.phone_secondary,
    status: "prospect",
    geocode_status: row.geocode_status,
    created_at: "",
    import_headers: row.import_headers,
    import_payload: row.import_payload,
  });
  const originalAddress = buildFullAddress(row);

  return {
    id: row.id,
    name: row.name,
    address: row.geocoding_normalized_address ?? originalAddress,
    phone: display.phone,
    city: row.city,
    province: row.province,
    commercial_status: normalizeCommercialStatus(row.commercial_status),
    geocode_status: row.geocode_status,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

function mapMapCompanies(rows: MapCompanyRow[]): MapCompany[] {
  return rows
    .map((row) => mapMapCompany(row))
    .filter((company): company is MapCompany => company !== null);
}

function applyMapFiltersQuery<T extends {
  in: (column: string, values: readonly string[]) => T;
  eq: (column: string, value: string) => T;
}>(query: T, filters: MapFiltersState): T {
  let nextQuery = query;

  if (filters.geolocatedOnly) {
    nextQuery = nextQuery.in("geocode_status", [...GEOCODED_MAP_STATUSES]);
  }

  if (filters.commercialStatus) {
    nextQuery = nextQuery.eq("commercial_status", filters.commercialStatus);
  }

  if (filters.province) {
    nextQuery = nextQuery.eq("province", filters.province);
  }

  if (filters.city) {
    nextQuery = nextQuery.eq("city", filters.city);
  }

  return nextQuery;
}

async function fetchMapCompanyCounts(supabase: Awaited<ReturnType<typeof createServerClient>>): Promise<{
  totalWithCoordinates: number;
  totalGeocodedConfirmed: number;
  error: string | null;
}> {
  const [withCoordsRes, geocodedConfirmedRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .not("latitude", "is", null)
      .not("longitude", "is", null),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .in("geocode_status", [...GEOCODED_MAP_STATUSES])
      .not("latitude", "is", null)
      .not("longitude", "is", null),
  ]);

  const firstError = withCoordsRes.error ?? geocodedConfirmedRes.error;
  if (firstError) {
    return { totalWithCoordinates: 0, totalGeocodedConfirmed: 0, error: describeDbError(firstError) };
  }

  return {
    totalWithCoordinates: withCoordsRes.count ?? 0,
    totalGeocodedConfirmed: geocodedConfirmedRes.count ?? 0,
    error: null,
  };
}

async function fetchDistinctProvinces(
  supabase: Awaited<ReturnType<typeof createServerClient>>
): Promise<{ provinces: string[]; error: string | null }> {
  const provinces = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("companies")
      .select("province")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .not("province", "is", null)
      .order("province", { ascending: true })
      .range(from, from + MAP_FETCH_PAGE_SIZE - 1);

    if (error) {
      return { provinces: [], error: describeDbError(error) };
    }

    const page = data ?? [];
    if (page.length === 0) {
      break;
    }

    for (const row of page) {
      const province = row.province?.trim();
      if (province) {
        provinces.add(province);
      }
    }

    if (page.length < MAP_FETCH_PAGE_SIZE) {
      break;
    }

    from += MAP_FETCH_PAGE_SIZE;
  }

  return {
    provinces: Array.from(provinces).sort((a, b) => a.localeCompare(b, "it")),
    error: null,
  };
}

export async function getMapPageBootstrap(): Promise<MapPageBootstrap> {
  const supabase = await createServerClient();

  const [countsResult, provincesResult] = await Promise.all([
    fetchMapCompanyCounts(supabase),
    fetchDistinctProvinces(supabase),
  ]);

  if (countsResult.error) {
    return { stats: EMPTY_MAP_STATS, provinces: [], error: countsResult.error };
  }

  if (provincesResult.error) {
    return { stats: EMPTY_MAP_STATS, provinces: [], error: provincesResult.error };
  }

  return {
    stats: {
      totalWithCoordinates: countsResult.totalWithCoordinates,
      totalGeocodedConfirmed: countsResult.totalGeocodedConfirmed,
      loadedCount: 0,
      isTruncated: countsResult.totalWithCoordinates > 0,
    },
    provinces: provincesResult.provinces,
    error: null,
  };
}

export async function getMapFilterCities(province: string): Promise<{
  cities: string[];
  error: string | null;
}> {
  const trimmedProvince = province.trim();
  if (!trimmedProvince) {
    return { cities: [], error: null };
  }

  const supabase = await createServerClient();
  const cities = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("companies")
      .select("city")
      .eq("province", trimmedProvince)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .not("city", "is", null)
      .order("city", { ascending: true })
      .range(from, from + MAP_FETCH_PAGE_SIZE - 1);

    if (error) {
      return { cities: [], error: describeDbError(error) };
    }

    const page = data ?? [];
    if (page.length === 0) {
      break;
    }

    for (const row of page) {
      const city = row.city?.trim();
      if (city) {
        cities.add(city);
      }
    }

    if (page.length < MAP_FETCH_PAGE_SIZE) {
      break;
    }

    from += MAP_FETCH_PAGE_SIZE;
  }

  return {
    cities: Array.from(cities).sort((a, b) => a.localeCompare(b, "it")),
    error: null,
  };
}

export async function getMapCompaniesInBounds(
  bounds: MapGeoBounds,
  filters: MapFiltersState,
  offset = 0
): Promise<MapCompaniesFetchResult> {
  const supabase = await createServerClient();
  const safeOffset = Math.max(0, offset);

  if (safeOffset >= MAP_MAX_FETCH_PER_BOUNDS) {
    return { data: [], error: null, hasMore: false, loadedCount: 0 };
  }

  const pageSize = Math.min(
    MAP_VIEWPORT_FETCH_PAGE_SIZE,
    MAP_MAX_FETCH_PER_BOUNDS - safeOffset
  );

  let query = supabase
    .from("companies")
    .select(MAP_COMPANY_COLUMNS)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", bounds.south)
    .lte("latitude", bounds.north)
    .gte("longitude", bounds.west)
    .lte("longitude", bounds.east);

  query = applyMapFiltersQuery(query, filters);

  const { data, error } = await query
    .order("name", { ascending: true })
    .range(safeOffset, safeOffset + pageSize - 1);

  if (error) {
    return { data: [], error: describeDbError(error), hasMore: false, loadedCount: 0 };
  }

  const companies = mapMapCompanies((data ?? []) as MapCompanyRow[]);

  return {
    data: companies,
    error: null,
    hasMore: companies.length === pageSize,
    loadedCount: companies.length,
  };
}

export function getMapFilterOptions(companies: MapCompany[]): {
  provinces: string[];
  cities: string[];
} {
  const provinces = new Set<string>();
  const cities = new Set<string>();

  for (const company of companies) {
    if (company.province?.trim()) {
      provinces.add(company.province.trim());
    }
    if (company.city?.trim()) {
      cities.add(company.city.trim());
    }
  }

  return {
    provinces: Array.from(provinces).sort((a, b) => a.localeCompare(b, "it")),
    cities: Array.from(cities).sort((a, b) => a.localeCompare(b, "it")),
  };
}
