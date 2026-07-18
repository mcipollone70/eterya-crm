import "server-only";

import { normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import { isBrandRelationshipStatus } from "@/lib/constants/brand-relationship";
import type {
  BrandRelationshipStatus,
  CommercialStatus,
  GeocodeStatus,
  Json,
} from "@/lib/supabase/types";
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
  MapCompanyBrand,
  MapFiltersState,
  MapGeoBounds,
  MapPageBootstrap,
} from "../types/map";
import {
  commercialStatusToBrandRelationship,
  companyMatchesMapCommercialStatusFilter,
  sortMapCompanyBrands,
} from "../utils/map-brand-markers";
import {
  companyMatchesBrandFilters,
  companyMatchesBrandSlugs,
} from "@/features/brands/utils/brand-shared";
import {
  accumulateStablePagedRows,
  aggregateMapCompanyBrands,
  MAP_COMPANY_BRANDS_PAGE_SIZE,
  mapCompanyCoordKey,
  mergeTwinMapCompanyBrands,
  twinGroupKeyForMapCompany,
} from "../utils/map-company-brands-aggregate";
import {
  hasMapBrandFilter,
  hasMapRelationshipFilter,
} from "../utils/map-filters";

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
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  // Aziende con coordinate valide restano in mappa anche senza Brand.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
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
    latitude,
    longitude,
    brands: [],
  };
}

type MapCompanyBrandRow = {
  company_id: string;
  brand_id: string;
  is_primary: boolean;
  relationship_status?: string | null;
  customer_code?: string | null;
  brands:
    | {
        name: string;
        slug: string;
        color: string | null;
      }
    | {
        name: string;
        slug: string;
        color: string | null;
      }[]
    | null;
};

/** Select preferito: relationship_status + customer_code se presenti sul DB. */
const MAP_COMPANY_BRAND_SELECT_FULL =
  "company_id,brand_id,is_primary,relationship_status,customer_code,brands(name,slug,color)";
const MAP_COMPANY_BRAND_SELECT_WITH_REL =
  "company_id,brand_id,is_primary,relationship_status,brands(name,slug,color)";
const MAP_COMPANY_BRAND_SELECT_BASE =
  "company_id,brand_id,is_primary,brands(name,slug,color)";

/**
 * Cache schema company_brands.
 * Live DB (2026-07-18): relationship_status e customer_code ASSENTI — usare BASE
 * e derivare relationship da companies.commercial_status per coerenza marker/popup.
 */
let cachedMapCompanyBrandSelect: string | null = null;
/** null = sconosciuto; true/false dopo il primo select riuscito. */
let cachedHasRelationshipStatusColumn: boolean | null = null;

function isMissingCompanyBrandsColumnError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return (
    code === "PGRST204" ||
    code === "42703" ||
    /Could not find the '.*' column of 'company_brands'/i.test(message) ||
    /column company_brands\./i.test(message)
  );
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function resolveBrandRelationshipForMapRow(
  row: MapCompanyBrandRow,
  companyCommercialStatus: CommercialStatus
): BrandRelationshipStatus {
  if (isBrandRelationshipStatus(row.relationship_status)) {
    return row.relationship_status;
  }

  // Colonna assente sul DB live: non defaultare a prospect (rompe Cliente/Prospect).
  // Usa commercial_status azienda come fallback schema-compatibile.
  if (cachedHasRelationshipStatusColumn === false) {
    return (
      commercialStatusToBrandRelationship(companyCommercialStatus) ?? "prospect"
    );
  }

  // Colonna presente ma valore null/invalid.
  return "prospect";
}

function mapCompanyBrandRow(
  row: MapCompanyBrandRow,
  companyCommercialStatus: CommercialStatus
): MapCompanyBrand | null {
  const brand = relationOne(row.brands);
  if (!brand) {
    return null;
  }

  return {
    brand_id: row.brand_id,
    name: brand.name,
    slug: brand.slug,
    color: brand.color,
    is_primary: row.is_primary,
    relationship_status: resolveBrandRelationshipForMapRow(
      row,
      companyCommercialStatus
    ),
    customer_code: row.customer_code ?? null,
  };
}

function nextBrandSelectFallback(current: string): string | null {
  if (current === MAP_COMPANY_BRAND_SELECT_FULL) {
    return MAP_COMPANY_BRAND_SELECT_WITH_REL;
  }
  if (current === MAP_COMPANY_BRAND_SELECT_WITH_REL) {
    return MAP_COMPANY_BRAND_SELECT_BASE;
  }
  if (current.includes("customer_code") && current.includes("relationship_status")) {
    return MAP_COMPANY_BRAND_SELECT_WITH_REL;
  }
  if (current.includes("relationship_status")) {
    return MAP_COMPANY_BRAND_SELECT_BASE;
  }
  return null;
}

/**
 * Carica brand di twin fuori dalla pagina corrente (stesso core name + stesse coords).
 * Evita perdita Brand quando un solo gemello è nel viewport.
 */
async function fetchOffPageTwinBrandsByTwinKey(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  companies: MapCompany[],
  commercialByCompanyId: Map<string, CommercialStatus>,
  brandSelect: string
): Promise<{
  offPageByTwinKey: Map<string, MapCompanyBrand[]>;
  brandSelect: string;
}> {
  const offPageByTwinKey = new Map<string, MapCompanyBrand[]>();
  const pageIds = new Set(companies.map((c) => c.id));

  // Unique coords from page companies that have a twin key
  const coordSamples = new Map<
    string,
    { latitude: number; longitude: number; twinKeys: Set<string> }
  >();
  for (const company of companies) {
    const twinKey = twinGroupKeyForMapCompany(company);
    if (!twinKey) continue;
    const coordKey = mapCompanyCoordKey(company.latitude, company.longitude);
    const sample = coordSamples.get(coordKey) ?? {
      latitude: company.latitude,
      longitude: company.longitude,
      twinKeys: new Set<string>(),
    };
    sample.twinKeys.add(twinKey);
    coordSamples.set(coordKey, sample);
  }

  if (coordSamples.size === 0) {
    return { offPageByTwinKey, brandSelect };
  }

  const twinIdToKey = new Map<string, string>();
  // Cap samples: N query sequenziali per coord bloccavano la mappa (~20s/pagina).
  const samples = Array.from(coordSamples.values()).slice(0, 40);
  const eps = 0.000015; // ~1.5m — allinea toFixed(5)
  const concurrency = 8;

  for (let i = 0; i < samples.length; i += concurrency) {
    const chunk = samples.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (sample) => {
        const { data, error } = await supabase
          .from("companies")
          .select("id,name,latitude,longitude")
          .gte("latitude", sample.latitude - eps)
          .lte("latitude", sample.latitude + eps)
          .gte("longitude", sample.longitude - eps)
          .lte("longitude", sample.longitude + eps);
        return { sample, data: error ? null : data };
      })
    );

    for (const { sample, data } of results) {
      if (!data?.length) continue;
      for (const row of data) {
        if (pageIds.has(row.id)) continue;
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const twinKey = twinGroupKeyForMapCompany({
          name: row.name,
          latitude: lat,
          longitude: lng,
        });
        if (!twinKey || !sample.twinKeys.has(twinKey)) continue;
        twinIdToKey.set(row.id, twinKey);
      }
    }
  }

  const twinIds = Array.from(twinIdToKey.keys());
  if (twinIds.length === 0) {
    return { offPageByTwinKey, brandSelect };
  }

  const twinChunkSize = 80;
  let select = brandSelect;

  for (let index = 0; index < twinIds.length; index += twinChunkSize) {
    const chunk = twinIds.slice(index, index + twinChunkSize);
    const { rows: pageRows, error: pageError } = await accumulateStablePagedRows({
      pageSize: MAP_COMPANY_BRANDS_PAGE_SIZE,
      fetchPage: async (from, to) => {
        let currentSelect = select;
        let { data, error } = await supabase
          .from("company_brands")
          .select(currentSelect)
          .in("company_id", chunk)
          .order("company_id", { ascending: true })
          .order("brand_id", { ascending: true })
          .range(from, to);

        while (error && isMissingCompanyBrandsColumnError(error)) {
          const fallback = nextBrandSelectFallback(currentSelect);
          if (!fallback) {
            break;
          }
          currentSelect = fallback;
          select = fallback;
          cachedMapCompanyBrandSelect = select;
          if (!select.includes("relationship_status")) {
            cachedHasRelationshipStatusColumn = false;
          }
          ({ data, error } = await supabase
            .from("company_brands")
            .select(select)
            .in("company_id", chunk)
            .order("company_id", { ascending: true })
            .order("brand_id", { ascending: true })
            .range(from, to));
        }

        if (error) {
          return { rows: [], error: describeDbError(error) };
        }
        return { rows: (data ?? []) as unknown as MapCompanyBrandRow[], error: null };
      },
    });

    if (pageError) {
      throw new Error(`company_brands twin page failed: ${pageError}`);
    }

    for (const row of pageRows) {
      const twinKey = twinIdToKey.get(row.company_id);
      if (!twinKey) continue;
      let status: CommercialStatus = "prospect";
      for (const company of companies) {
        if (twinGroupKeyForMapCompany(company) === twinKey) {
          status = commercialByCompanyId.get(company.id) ?? "prospect";
          break;
        }
      }
      const mapped = mapCompanyBrandRow(row, status);
      if (!mapped) continue;
      const list = offPageByTwinKey.get(twinKey) ?? [];
      list.push(mapped);
      offPageByTwinKey.set(twinKey, list);
    }
  }

  // Dedup per twin key
  for (const [key, list] of offPageByTwinKey) {
    offPageByTwinKey.set(key, aggregateMapCompanyBrands(list));
  }

  return { offPageByTwinKey, brandSelect: select };
}

/**
 * Carica TUTTE le company_brands per le aziende mappa.
 * - batch .in su company_id (chunk piccoli)
 * - paginazione .range stabile company_id,brand_id (niente troncamento PostgREST)
 * - FAIL su errore pagina (niente break silenzioso / payload parziale)
 * - aggregazione Map<company_id, BrandAssociation[]> (mai overwrite single)
 * - merge twin in pagina + brand di twin fuori pagina
 * LEFT JOIN semantico: nessuna azienda esclusa se manca Brand.
 */
async function attachBrandsToMapCompanies(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  companies: MapCompany[]
): Promise<MapCompany[]> {
  if (companies.length === 0) {
    return companies;
  }

  const byCompanyId = new Map<string, MapCompanyBrand[]>();
  const commercialByCompanyId = new Map(
    companies.map((company) => [company.id, company.commercial_status] as const)
  );
  const ids = companies.map((company) => company.id);
  const chunkSize = 80;
  let brandSelect = cachedMapCompanyBrandSelect ?? MAP_COMPANY_BRAND_SELECT_FULL;

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);

    const { rows: pageRows, error: pageError } = await accumulateStablePagedRows({
      pageSize: MAP_COMPANY_BRANDS_PAGE_SIZE,
      fetchPage: async (from, to) => {
        let currentSelect = brandSelect;
        let { data, error } = await supabase
          .from("company_brands")
          .select(currentSelect)
          .in("company_id", chunk)
          .order("company_id", { ascending: true })
          .order("brand_id", { ascending: true })
          .range(from, to);

        while (error && isMissingCompanyBrandsColumnError(error)) {
          const fallback = nextBrandSelectFallback(currentSelect);
          if (!fallback) {
            break;
          }
          currentSelect = fallback;
          brandSelect = fallback;
          cachedMapCompanyBrandSelect = brandSelect;
          if (!brandSelect.includes("relationship_status")) {
            cachedHasRelationshipStatusColumn = false;
          }
          ({ data, error } = await supabase
            .from("company_brands")
            .select(brandSelect)
            .in("company_id", chunk)
            .order("company_id", { ascending: true })
            .order("brand_id", { ascending: true })
            .range(from, to));
        }

        if (!error) {
          if (!cachedMapCompanyBrandSelect) {
            cachedMapCompanyBrandSelect = brandSelect;
          }
          if (cachedHasRelationshipStatusColumn == null) {
            cachedHasRelationshipStatusColumn = brandSelect.includes(
              "relationship_status"
            );
          }
        }

        if (error) {
          return { rows: [], error: describeDbError(error) };
        }
        return { rows: (data ?? []) as unknown as MapCompanyBrandRow[], error: null };
      },
    });

    if (pageError) {
      throw new Error(`company_brands page failed: ${pageError}`);
    }

    for (const row of pageRows) {
      const companyStatus =
        commercialByCompanyId.get(row.company_id) ?? "prospect";
      const mapped = mapCompanyBrandRow(row, companyStatus);
      if (!mapped) {
        continue;
      }
      const list = byCompanyId.get(row.company_id) ?? [];
      list.push(mapped);
      byCompanyId.set(row.company_id, list);
    }
  }

  const withOwnBrands = companies.map((company) => ({
    ...company,
    // Dedup + ordine stabile; tiene TUTTI i Brand distinti (no slice / no [0]).
    brands: aggregateMapCompanyBrands(byCompanyId.get(company.id) ?? []),
  }));

  // Twin off-page: best-effort. Non deve mai azzerare i marker geolocalizzati.
  let offPageByTwinKey = new Map<string, MapCompanyBrand[]>();
  try {
    const twinResult = await fetchOffPageTwinBrandsByTwinKey(
      supabase,
      withOwnBrands,
      commercialByCompanyId,
      brandSelect
    );
    offPageByTwinKey = twinResult.offPageByTwinKey;
    brandSelect = twinResult.brandSelect;
    cachedMapCompanyBrandSelect = brandSelect;
  } catch {
    cachedMapCompanyBrandSelect = brandSelect;
  }

  // Twin in viewport + brand di twin fuori pagina → unione completa.
  return mergeTwinMapCompanyBrands(withOwnBrands, offPageByTwinKey).map(
    (company) => ({
      ...company,
      brands: sortMapCompanyBrands(company.brands ?? []),
    })
  );
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

  // commercialStatus: NON filtrare su companies.commercial_status qui.
  // Con Brand la fonte è relationship_status (applicata dopo attachBrands).

  const province = filters.province?.trim() ?? "";
  if (province) {
    nextQuery = nextQuery.eq("province", province);
  }

  const city = filters.city?.trim() ?? "";
  if (city) {
    nextQuery = nextQuery.eq("city", city);
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

  // Bounds espliciti: lng∈[west,east], lat∈[south,north] — mai scambiati.
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

  const rows = (data ?? []) as MapCompanyRow[];
  const geolocated = mapMapCompanies(rows);
  // Aziende con coordinate valide restano in lista anche senza Brand (nessun INNER JOIN).
  // Se company_brands fallisce: restituisci comunque i geolocalizzati (mappa non vuota).
  let withBrands: MapCompany[];
  try {
    withBrands = await attachBrandsToMapCompanies(supabase, geolocated);
  } catch {
    withBrands = geolocated;
  }

  const brandFilterActive = hasMapBrandFilter(filters);
  const relationshipFilterActive = hasMapRelationshipFilter(filters);

  const companies = withBrands.filter((company) => {
    // Nessun Brand selezionato → TUTTE le geolocalizzate (anche legacy senza company_brands).
    if (!brandFilterActive && !relationshipFilterActive) {
      return true;
    }

    if (brandFilterActive) {
      if (
        !companyMatchesBrandSlugs(
          company.brands ?? [],
          filters.brandSlugs,
          filters.brandMatchMode ?? "or"
        )
      ) {
        return false;
      }
      if (relationshipFilterActive) {
        return companyMatchesBrandFilters({
          brands: company.brands ?? [],
          selectedSlugs: filters.brandSlugs,
          matchMode: filters.brandMatchMode ?? "or",
          commercialStatus: filters.commercialStatus as CommercialStatus,
          legacyCommercialStatus: company.commercial_status,
        });
      }
      return true;
    }

    // Solo relazione (Cliente/Prospect/…): almeno un Brand con quello status,
    // oppure commercial_status legacy se l'azienda non ha company_brands.
    return companyMatchesMapCommercialStatusFilter(
      company,
      filters.commercialStatus as CommercialStatus
    );
  });

  return {
    data: companies,
    error: null,
    hasMore: rows.length === pageSize,
    loadedCount: rows.length,
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
