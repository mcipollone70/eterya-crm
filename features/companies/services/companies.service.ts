import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  DASHBOARD_COMMERCIAL_STATUSES,
  normalizeCommercialStatus,
  type DashboardCommercialStatus,
} from "@/lib/constants/commercial-status";
import type {
  CommercialStatus,
  CompanyStatus,
  GeocodeStatus,
  Json,
  Tables,
  UpdateTables,
} from "@/lib/supabase/types";
import type { PriorityTier } from "@/lib/commercial-priority/types";
import type { PriorityFilterValue } from "@/lib/constants/priority-tier";
import type { LastVisitFilterValue } from "@/lib/constants/last-visit";
import type { InterestLevel, ProductFamily } from "@/lib/constants/product-catalog";
import { thresholdIsoDaysAgo } from "@/lib/last-visit/format";
import {
  computeCompanyPriorityFields,
  matchesPriorityFilter,
} from "@/lib/commercial-priority/compute";
import type { CompanyPrioritySource } from "@/lib/commercial-priority/types";
import {
  buildRowPriorityContext,
  fetchOpenOpportunityCompanyIds,
} from "./commercial-priority.service";
import { resolveCompanyIdsForProductFilters } from "@/features/products/services/company-product-interests.service";
import type { CompanyInsert } from "../utils/build-db-rows";
import {
  COMPANIES_DEFAULT_PAGE,
  COMPANIES_DEFAULT_PAGE_SIZE,
  COMPANIES_PRIORITY_FETCH_BATCH_SIZE,
  COMPANIES_PRIORITY_MAX_ROWS,
  clampCompaniesPage,
  isCompaniesPageSize,
} from "../constants/companies-pagination";
import {
  fetchCompanyBrandsByCompanyIds,
  resolveCompanyIdsForBrandAndRelationship,
  resolveCompanyIdsForBrandSlugs,
  type BrandAssociationView,
} from "@/features/brands/services/company-brands-batch.service";
import type { BrandMatchMode } from "@/features/brands/utils/brand-shared";

export type Company = Tables<"companies">;
export type CompanyUpdate = UpdateTables<"companies">;

/** Colonne mostrate in elenco — sottoinsieme leggero della riga completa. */
export interface CompanyListItem {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  vat_number: string | null;
  phone: string | null;
  email: string | null;
  status: CompanyStatus;
  commercial_status: CommercialStatus;
  geocode_status: GeocodeStatus;
  created_at: string;
  priority_score: number;
  priority_tier: PriorityTier;
  priority_excluded: boolean;
  last_visit_at: string | null;
  /** Brand da company_brands (batch, no N+1). */
  brands: BrandAssociationView[];
}

export interface ListCompaniesOptions {
  priorityTier?: PriorityFilterValue | null;
  sortByPriority?: boolean;
  lastVisitFilter?: LastVisitFilterValue | null;
  sortByLastVisit?: boolean;
  productFamily?: ProductFamily | null;
  interestLevel?: InterestLevel | null;
  purchasedProductId?: string | null;
  /** Slug ufficiali brands.slug (eterya, zanzar, …). */
  brandSlugs?: string[] | null;
  brandMatchMode?: BrandMatchMode | null;
  page?: number;
  pageSize?: number;
}

function intersectIdLists(
  left: string[] | null | undefined,
  right: string[] | null | undefined
): string[] | null {
  if (left == null && right == null) return null;
  if (left == null) return right ?? null;
  if (right == null) return left;
  const rightSet = new Set(right);
  return left.filter((id) => rightSet.has(id));
}

async function attachBrandsToCompanyListItems(
  items: CompanyListItem[]
): Promise<CompanyListItem[]> {
  if (items.length === 0) return items;
  const commercialByCompanyId = new Map(
    items.map((item) => [item.id, item.commercial_status] as const)
  );
  const { byCompanyId, error } = await fetchCompanyBrandsByCompanyIds(
    items.map((item) => item.id),
    { commercialByCompanyId }
  );
  if (error) {
    // Non bloccare l'elenco: badge brand vuoti.
    return items.map((item) => ({ ...item, brands: item.brands ?? [] }));
  }
  return items.map((item) => ({
    ...item,
    brands: byCompanyId.get(item.id) ?? [],
  }));
}

export type CommercialStatusCounts = Record<DashboardCommercialStatus, number>;

/** Colonne SELECT per l'elenco aziende (incluso import_payload per fallback di lettura). */
export const COMPANY_LIST_COLUMNS =
  "id,name,city,province,vat_number,tax_code,phone,email,contact_phone,contact_email,mobile,phone_secondary,pec,status,commercial_status,geocode_status,revenue,created_at,last_visit_at,last_contact_at,import_headers,import_payload";

const COMPANY_LIST_COLUMNS_FALLBACK =
  "id,name,city,province,vat_number,tax_code,phone,email,contact_phone,contact_email,mobile,phone_secondary,pec,status,geocode_status,revenue,created_at,last_visit_at,last_contact_at,import_headers,import_payload";

const INVALID_DISPLAY_VALUES = new Set(["false", "true", "n", "s", "null", "undefined"]);

const VAT_PAYLOAD_KEYS = [
  "Partita IVA",
  "PARTITA IVA",
  "P.IVA",
  "P. IVA",
  "partita iva",
  "VAT",
  "vat_number",
  "Codice Fiscale",
  "CODICE FISCALE",
] as const;

const PHONE_PREFIX_PAYLOAD_KEYS = ["Prefisso", "PREFISSO", "prefisso"] as const;

/** Numero telefonico (non il flag booleano TELEFONO presente negli export Infocamere). */
const PHONE_NUMBER_PAYLOAD_KEYS = [
  "NUMERO",
  "Numero",
  "numero",
  "Telefono",
  "Tel",
  "telefono",
  "phone",
  "contact_phone",
  "Cellulare",
  "cellulare",
  "mobile",
] as const;

const PHONE_FLAG_PAYLOAD_KEYS = ["TELEFONO", "Telefono", "telefono"] as const;

const EMAIL_PAYLOAD_KEYS = [
  "Email",
  "E-mail",
  "EMAIL GENERICA",
  "email",
  "contact_email",
  "Mail",
  "mail",
  "PEC",
  "pec",
] as const;

function isValidDisplayValue(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }
  return !INVALID_DISPLAY_VALUES.has(trimmed.toLowerCase());
}

function coerceDisplayValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const asString =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : null;
  if (!asString || !isValidDisplayValue(asString)) {
    return null;
  }
  return asString.trim();
}

function normalizePayload(payload: Json | null | undefined): Record<string, unknown> | null {
  if (payload === null || payload === undefined) {
    return null;
  }
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return null;
}

function payloadField(payload: Json | null | undefined, keys: readonly string[]): string | null {
  const record = normalizePayload(payload);
  if (!record) {
    return null;
  }

  const normalizedEntries = new Map<string, string>();

  for (const [rawKey, value] of Object.entries(record)) {
    const trimmed = coerceDisplayValue(value);
    if (trimmed) {
      normalizedEntries.set(rawKey.toLowerCase(), trimmed);
    }
  }

  for (const key of keys) {
    const value = normalizedEntries.get(key.toLowerCase());
    if (value) {
      return value;
    }
  }

  return null;
}

function payloadFieldByHeaderMatch(
  payload: Json | null | undefined,
  headers: string[] | null | undefined,
  matchers: readonly string[],
  exact = false
): string | null {
  const record = normalizePayload(payload);
  if (!record || !headers?.length) {
    return null;
  }

  for (const header of headers) {
    const headerLower = header.toLowerCase().trim();
    const matches = matchers.some((matcher) => {
      const matcherLower = matcher.toLowerCase();
      return exact
        ? headerLower === matcherLower
        : headerLower === matcherLower || headerLower.includes(matcherLower);
    });
    if (!matches) {
      continue;
    }
    const value = coerceDisplayValue(record[header]);
    if (value) {
      return value;
    }
  }

  return null;
}

function isPhoneFlagExplicitlyFalse(payload: Json | null | undefined): boolean {
  const record = normalizePayload(payload);
  if (!record) {
    return false;
  }

  for (const key of PHONE_FLAG_PAYLOAD_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim().toLowerCase() === "false") {
      return true;
    }
  }

  return false;
}

function payloadPhone(
  payload: Json | null | undefined,
  headers?: string[] | null
): string | null {
  if (isPhoneFlagExplicitlyFalse(payload)) {
    return null;
  }

  const prefix =
    payloadField(payload, PHONE_PREFIX_PAYLOAD_KEYS) ??
    payloadFieldByHeaderMatch(payload, headers, ["prefisso"]);
  const number =
    payloadField(payload, PHONE_NUMBER_PAYLOAD_KEYS) ??
    payloadFieldByHeaderMatch(payload, headers, ["numero"], true) ??
    payloadFieldByHeaderMatch(payload, headers, ["telefono", "tel", "cellulare", "mobile"]);

  if (prefix && number) {
    return `${prefix}${number}`;
  }
  if (number) {
    return number;
  }
  return null;
}

function isPrefixOnlyPhoneValue(
  value: string,
  payload: Json | null | undefined,
  headers?: string[] | null
): boolean {
  const prefix =
    payloadField(payload, PHONE_PREFIX_PAYLOAD_KEYS) ??
    payloadFieldByHeaderMatch(payload, headers, ["prefisso"]);
  return Boolean(prefix && value === prefix);
}

function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    if (isValidDisplayValue(value)) {
      return value!.trim();
    }
  }
  return null;
}

function resolveListField(
  columns: (string | null | undefined)[],
  payload: Json | null | undefined,
  keys: readonly string[]
): string | null {
  return firstNonEmpty(...columns) ?? payloadField(payload, keys);
}

type CompanyListRow = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  vat_number: string | null;
  tax_code?: string | null;
  phone: string | null;
  email: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  mobile?: string | null;
  phone_secondary?: string | null;
  pec?: string | null;
  status: CompanyStatus;
  commercial_status?: CommercialStatus | null;
  geocode_status: GeocodeStatus;
  revenue?: number | null;
  created_at: string;
  last_visit_at?: string | null;
  last_contact_at?: string | null;
  import_headers?: string[] | null;
  import_payload?: Json | null;
};

function resolvePhoneField(row: CompanyListRow): string | null {
  const fromPayload = payloadPhone(row.import_payload, row.import_headers);
  if (fromPayload) {
    return fromPayload;
  }

  const fromColumns = firstNonEmpty(
    row.phone,
    row.contact_phone,
    row.mobile,
    row.phone_secondary
  );
  if (fromColumns && !isPrefixOnlyPhoneValue(fromColumns, row.import_payload, row.import_headers)) {
    return fromColumns;
  }

  return null;
}

function resolveVatField(row: CompanyListRow): string | null {
  return (
    resolveListField([row.vat_number, row.tax_code], row.import_payload, VAT_PAYLOAD_KEYS) ??
    payloadFieldByHeaderMatch(row.import_payload, row.import_headers, [
      "partita iva",
      "p.iva",
      "p iva",
      "vat",
    ])
  );
}

function resolveEmailField(row: CompanyListRow): string | null {
  return (
    resolveListField(
      [row.email, row.contact_email, row.pec],
      row.import_payload,
      EMAIL_PAYLOAD_KEYS
    ) ??
    payloadFieldByHeaderMatch(row.import_payload, row.import_headers, [
      "email",
      "e-mail",
      "mail",
      "pec",
    ])
  );
}

function mapListItem(row: CompanyListRow): Omit<
  CompanyListItem,
  "priority_score" | "priority_tier" | "priority_excluded"
> {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    province: row.province,
    vat_number: resolveVatField(row),
    phone: resolvePhoneField(row),
    email: resolveEmailField(row),
    status: row.status,
    commercial_status: normalizeCommercialStatus(row.commercial_status),
    geocode_status: row.geocode_status,
    created_at: row.created_at,
    last_visit_at: row.last_visit_at ?? null,
    brands: [],
  };
}

async function enrichListItemsWithPriority(
  rows: CompanyListRow[],
  options?: ListCompaniesOptions,
  { filterExcluded = true }: { filterExcluded?: boolean } = {}
): Promise<CompanyListItem[]> {
  const openOpportunityCompanyIds = await fetchOpenOpportunityCompanyIds();
  const openOpportunitySet = new Set(openOpportunityCompanyIds);

  let items = rows
    .map((row) => {
      const base = mapListItem(row);
      const context = buildRowPriorityContext(
        row.id,
        row.last_visit_at ?? null,
        row.last_contact_at ?? null,
        openOpportunitySet
      );
      const priority = computeCompanyPriorityFields(row as CompanyPrioritySource, context);

      return {
        ...base,
        ...priority,
      };
    });

  if (filterExcluded) {
    items = items.filter((item) => !item.priority_excluded);
  }

  if (options?.priorityTier) {
    items = items.filter((item) => matchesPriorityFilter(item.priority_tier, options.priorityTier!));
  }

  if (options?.sortByPriority) {
    items.sort((a, b) => b.priority_score - a.priority_score);
  }

  return items;
}

/** Stessi fallback della lista (payload, tax_code, PREFISSO+NUMERO, PEC). Usato dal dettaglio azienda. */
export function resolveCompanyDisplayFields(company: CompanyListRow): Pick<
  CompanyListItem,
  "vat_number" | "phone" | "email"
> {
  return {
    vat_number: resolveVatField(company),
    phone: resolvePhoneField(company),
    email: resolveEmailField(company),
  };
}

function applyCommercialStatusFilter<T extends { eq: (col: string, val: string) => T; or: (filters: string) => T }>(
  query: T,
  commercialStatus: CommercialStatus
): T {
  if (commercialStatus === "prospect") {
    return query.or("commercial_status.eq.prospect,commercial_status.is.null");
  }
  return query.eq("commercial_status", commercialStatus);
}

function applyLastVisitFilter<
  T extends {
    is: (col: string, val: null) => T;
    or: (filters: string) => T;
    lt: (col: string, val: string) => T;
  },
>(query: T, lastVisitFilter: LastVisitFilterValue): T {
  switch (lastVisitFilter) {
    case "never":
      return query.is("last_visit_at", null);
    case "over_30":
      return query.or(`last_visit_at.is.null,last_visit_at.lt.${thresholdIsoDaysAgo(30)}`);
    case "over_60":
      return query.or(`last_visit_at.is.null,last_visit_at.lt.${thresholdIsoDaysAgo(60)}`);
    case "over_90":
      return query.or(`last_visit_at.is.null,last_visit_at.lt.${thresholdIsoDaysAgo(90)}`);
  }
}

/**
 * Nota: l'accesso avviene con il client server auth-scoped (`@supabase/ssr`),
 * quindi le query girano come ruolo `authenticated` e sono soggette alle policy
 * RLS. I chiamanti verificano `isSupabaseConfigured()` per il degrado grazioso
 * quando l'ambiente pubblico non è presente.
 */

async function fetchCompanyRowsInBatches(
  runQuery: (from: number, to: number) => Promise<{
    data: CompanyListRow[] | null;
    count: number | null;
    error: PostgrestError | null;
  }>,
  maxRows = COMPANIES_PRIORITY_MAX_ROWS
): Promise<{ rows: CompanyListRow[]; count: number | null; error: string | null }> {
  const rows: CompanyListRow[] = [];
  let offset = 0;
  let totalCount: number | null = null;

  while (offset < maxRows) {
    const batchSize = Math.min(COMPANIES_PRIORITY_FETCH_BATCH_SIZE, maxRows - offset);
    const result = await runQuery(offset, offset + batchSize - 1);

    if (result.error) {
      return { rows: [], count: null, error: describeDbError(result.error) };
    }

    const page = result.data ?? [];
    if (totalCount === null) {
      totalCount = result.count;
    }

    if (page.length === 0) {
      break;
    }

    rows.push(...page);
    offset += page.length;

    if (page.length < batchSize) {
      break;
    }
  }

  return { rows, count: totalCount, error: null };
}

export async function listCompanies(
  commercialStatus?: CommercialStatus | null,
  options?: ListCompaniesOptions
): Promise<{ data: CompanyListItem[]; count: number; error: string | null }> {
  const page = Math.max(COMPANIES_DEFAULT_PAGE, options?.page ?? COMPANIES_DEFAULT_PAGE);
  const pageSize = isCompaniesPageSize(options?.pageSize ?? COMPANIES_DEFAULT_PAGE_SIZE)
    ? options!.pageSize!
    : COMPANIES_DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const usePriorityProcessing = Boolean(options?.priorityTier || options?.sortByPriority);
  const supabase = await createServerClient();
  const brandSlugs = (options?.brandSlugs ?? []).filter(Boolean);
  const brandMatchMode = options?.brandMatchMode ?? "or";
  /** Con Brand+stato: filtro su company_brands.relationship_status (fallback commercial). */
  const brandHandlesCommercial =
    brandSlugs.length > 0 && Boolean(commercialStatus);
  /** Stato legacy su companies solo se non già filtrato via Brand. */
  const statusForCompanyColumn =
    commercialStatus && !brandHandlesCommercial ? commercialStatus : null;

  const productFilterResult = await resolveCompanyIdsForProductFilters({
    productFamily: options?.productFamily,
    interestLevel: options?.interestLevel,
    purchasedProductId: options?.purchasedProductId,
  });

  if (productFilterResult.error) {
    return { data: [], count: 0, error: productFilterResult.error };
  }

  if (productFilterResult.companyIds && productFilterResult.companyIds.length === 0) {
    return { data: [], count: 0, error: null };
  }

  let brandCompanyIds: string[] | null = null;
  if (brandSlugs.length > 0) {
    if (commercialStatus) {
      const brandRel = await resolveCompanyIdsForBrandAndRelationship({
        brandSlugs,
        commercialStatus,
        matchMode: brandMatchMode,
      });
      if (brandRel.error) {
        return { data: [], count: 0, error: brandRel.error };
      }
      brandCompanyIds = brandRel.companyIds;
    } else {
      const brandOnly = await resolveCompanyIdsForBrandSlugs({
        brandSlugs,
        matchMode: brandMatchMode,
      });
      if (brandOnly.error) {
        return { data: [], count: 0, error: brandOnly.error };
      }
      brandCompanyIds = brandOnly.companyIds;
    }

    if (brandCompanyIds && brandCompanyIds.length === 0) {
      return { data: [], count: 0, error: null };
    }
  }

  const scopedCompanyIds = intersectIdLists(
    productFilterResult.companyIds,
    brandCompanyIds
  );

  if (scopedCompanyIds && scopedCompanyIds.length === 0) {
    return { data: [], count: 0, error: null };
  }

  let query = supabase.from("companies").select(COMPANY_LIST_COLUMNS, { count: "exact" });

  if (options?.sortByLastVisit && !options?.sortByPriority) {
    query = query.order("last_visit_at", { ascending: false, nullsFirst: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (!usePriorityProcessing) {
    query = query.range(offset, offset + pageSize - 1);
  }

  if (statusForCompanyColumn) {
    query = applyCommercialStatusFilter(query, statusForCompanyColumn);
  }

  if (scopedCompanyIds) {
    query = query.in("id", scopedCompanyIds);
  }

  if (options?.lastVisitFilter) {
    query = applyLastVisitFilter(query, options.lastVisitFilter);
  }

  let data: CompanyListRow[] | null = null;
  let count: number | null = null;
  let error: PostgrestError | null = null;

  if (!usePriorityProcessing) {
    const primary = await query;
    data = (primary.data ?? null) as CompanyListRow[] | null;
    count = primary.count;
    error = primary.error;

    if (
      (data?.length ?? 0) === 0 &&
      (count ?? 0) > 0 &&
      offset >= (count ?? 0)
    ) {
      const safePage = clampCompaniesPage(page, count ?? 0, pageSize);
      const safeOffset = (safePage - 1) * pageSize;

      let retryQuery = supabase.from("companies").select(COMPANY_LIST_COLUMNS, { count: "exact" });

      if (options?.sortByLastVisit && !options?.sortByPriority) {
        retryQuery = retryQuery.order("last_visit_at", { ascending: false, nullsFirst: true });
      } else {
        retryQuery = retryQuery.order("created_at", { ascending: false });
      }

      if (statusForCompanyColumn) {
        retryQuery = applyCommercialStatusFilter(retryQuery, statusForCompanyColumn);
      }
      if (scopedCompanyIds) {
        retryQuery = retryQuery.in("id", scopedCompanyIds);
      }
      if (options?.lastVisitFilter) {
        retryQuery = applyLastVisitFilter(retryQuery, options.lastVisitFilter);
      }

      const retried = await retryQuery.range(safeOffset, safeOffset + pageSize - 1);
      data = (retried.data ?? null) as CompanyListRow[] | null;
      count = retried.count;
      error = retried.error;
    }
  }

  if (error && /commercial_status/i.test(error.message)) {
    let fallbackQuery = supabase
      .from("companies")
      .select(COMPANY_LIST_COLUMNS_FALLBACK, { count: "exact" });

    if (options?.sortByLastVisit && !options?.sortByPriority) {
      fallbackQuery = fallbackQuery.order("last_visit_at", { ascending: false, nullsFirst: true });
    } else {
      fallbackQuery = fallbackQuery.order("created_at", { ascending: false });
    }

    fallbackQuery = usePriorityProcessing
      ? fallbackQuery
      : fallbackQuery.range(offset, offset + pageSize - 1);

    if (statusForCompanyColumn && statusForCompanyColumn !== "prospect") {
      return { data: [], count: 0, error: describeDbError(error) };
    }

    if (options?.lastVisitFilter) {
      fallbackQuery = applyLastVisitFilter(fallbackQuery, options.lastVisitFilter);
    }

    if (scopedCompanyIds) {
      fallbackQuery = fallbackQuery.in("id", scopedCompanyIds);
    }

    const fallback = await fallbackQuery;
    data = (fallback.data ?? null) as CompanyListRow[] | null;
    count = fallback.count;
    error = fallback.error;
  }

  if (error) {
    if (/last_visit_at/i.test(error.message)) {
      let legacyQuery = supabase
        .from("companies")
        .select(COMPANY_LIST_COLUMNS_FALLBACK.replace(",last_visit_at", ""), { count: "exact" })
        .order("created_at", { ascending: false });

      legacyQuery = usePriorityProcessing
        ? legacyQuery
        : legacyQuery.range(offset, offset + pageSize - 1);

      if (statusForCompanyColumn) {
        legacyQuery = applyCommercialStatusFilter(legacyQuery, statusForCompanyColumn);
      }

      if (scopedCompanyIds) {
        legacyQuery = legacyQuery.in("id", scopedCompanyIds);
      }

      const legacy = await legacyQuery;
      if (legacy.error) {
        return { data: [], count: 0, error: describeDbError(legacy.error) };
      }

      const legacyRows = ((legacy.data ?? []) as unknown as CompanyListRow[]).map((row) => ({
        ...row,
        last_visit_at: null,
      }));

      if (usePriorityProcessing) {
        const batched = await fetchCompanyRowsInBatches(async (from, to) => {
          let batchQuery = supabase
            .from("companies")
            .select(COMPANY_LIST_COLUMNS_FALLBACK.replace(",last_visit_at", ""), { count: "exact" })
            .order("created_at", { ascending: false });

          if (statusForCompanyColumn) {
            batchQuery = applyCommercialStatusFilter(batchQuery, statusForCompanyColumn);
          }

          if (scopedCompanyIds) {
            batchQuery = batchQuery.in("id", scopedCompanyIds);
          }

          const result = await batchQuery.range(from, to);
          return {
            data: ((result.data ?? []) as unknown as CompanyListRow[]).map((row) => ({
              ...row,
              last_visit_at: null,
            })),
            count: result.count,
            error: result.error,
          };
        });

        if (batched.error) {
          return { data: [], count: 0, error: batched.error };
        }

        const enriched = await enrichListItemsWithPriority(batched.rows, options);
        const safePage = clampCompaniesPage(page, enriched.length, pageSize);
        const pageOffset = (safePage - 1) * pageSize;
        return {
          data: await attachBrandsToCompanyListItems(
            enriched.slice(pageOffset, pageOffset + pageSize)
          ),
          count: enriched.length,
          error: null,
        };
      }

      return {
        data: await attachBrandsToCompanyListItems(
          await enrichListItemsWithPriority(legacyRows, options, { filterExcluded: false })
        ),
        count: legacy.count ?? 0,
        error: null,
      };
    }

    return { data: [], count: 0, error: describeDbError(error) };
  }

  if (usePriorityProcessing) {
    const batched = await fetchCompanyRowsInBatches(async (from, to) => {
      let batchQuery = supabase.from("companies").select(COMPANY_LIST_COLUMNS, { count: "exact" });

      if (options?.sortByLastVisit && !options?.sortByPriority) {
        batchQuery = batchQuery.order("last_visit_at", { ascending: false, nullsFirst: true });
      } else {
        batchQuery = batchQuery.order("created_at", { ascending: false });
      }

      if (statusForCompanyColumn) {
        batchQuery = applyCommercialStatusFilter(batchQuery, statusForCompanyColumn);
      }

      if (scopedCompanyIds) {
        batchQuery = batchQuery.in("id", scopedCompanyIds);
      }

      if (options?.lastVisitFilter) {
        batchQuery = applyLastVisitFilter(batchQuery, options.lastVisitFilter);
      }

      const result = await batchQuery.range(from, to);
      return {
        data: (result.data ?? []) as CompanyListRow[],
        count: result.count,
        error: result.error,
      };
    });

    if (batched.error) {
      return { data: [], count: 0, error: batched.error };
    }

    const enriched = await enrichListItemsWithPriority(batched.rows, options);
    const sorted = options?.sortByLastVisit
      ? [...enriched].sort((a, b) => {
          if (!a.last_visit_at && !b.last_visit_at) {
            return 0;
          }
          if (!a.last_visit_at) {
            return 1;
          }
          if (!b.last_visit_at) {
            return -1;
          }
          return new Date(b.last_visit_at).getTime() - new Date(a.last_visit_at).getTime();
        })
      : enriched;
    const safePage = clampCompaniesPage(page, sorted.length, pageSize);
    const pageOffset = (safePage - 1) * pageSize;

    return {
      data: await attachBrandsToCompanyListItems(
        sorted.slice(pageOffset, pageOffset + pageSize)
      ),
      count: sorted.length,
      error: null,
    };
  }

  return {
    data: await attachBrandsToCompanyListItems(
      await enrichListItemsWithPriority(data ?? [], options, { filterExcluded: false })
    ),
    count: count ?? 0,
    error: null,
  };
}

export async function getCommercialStatusCounts(): Promise<{
  data: CommercialStatusCounts | null;
  error: string | null;
}> {
  const supabase = await createServerClient();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_commercial_status_counts" as never
  );

  if (!rpcError && rpcData && typeof rpcData === "object") {
    const row = rpcData as Record<string, unknown>;
    const data = {
      prospect: Number(row.prospect ?? 0),
      cliente: Number(row.cliente ?? 0),
      ex_cliente: Number(row.ex_cliente ?? 0),
      da_ricontattare: Number(row.da_ricontattare ?? 0),
    } as CommercialStatusCounts;

    return { data, error: null };
  }

  const results = await Promise.all(
    DASHBOARD_COMMERCIAL_STATUSES.map(async (status) => {
      let countQuery = supabase
        .from("companies")
        .select("id", { count: "exact", head: true });

      countQuery = applyCommercialStatusFilter(countQuery, status);

      const { count, error } = await countQuery;
      return { status, count: count ?? 0, error };
    })
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    return { data: null, error: describeDbError(failed.error) };
  }

  const data = Object.fromEntries(
    results.map(({ status, count }) => [status, count])
  ) as CommercialStatusCounts;

  return { data, error: null };
}

export async function getCompanyById(
  id: string
): Promise<{ data: Company | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return { data: data ?? null, error: describeDbError(error) };
}

export async function insertCompany(
  row: CompanyInsert
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .insert(row)
    .select("id")
    .single();

  return { id: data?.id ?? null, error: describeDbError(error) };
}

export async function updateCompanyById(
  id: string,
  row: CompanyUpdate
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").update(row).eq("id", id);
  return { error: describeDbError(error) };
}

export async function deleteCompanyById(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  return { error: describeDbError(error) };
}
