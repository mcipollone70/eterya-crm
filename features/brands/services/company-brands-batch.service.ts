import "server-only";

import { isBrandRelationshipStatus } from "@/lib/constants/brand-relationship";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { BrandRelationshipStatus, CommercialStatus } from "@/lib/supabase/types";
import {
  COMPANY_BRANDS_PAGE_SIZE,
  commercialStatusToBrandRelationship,
  normalizeBrandSlug,
  sortBrandAssociations,
  type BrandAssociationView,
  type BrandMatchMode,
} from "../utils/brand-shared";

export type { BrandAssociationView };

type CompanyBrandBatchRow = {
  company_id: string;
  brand_id: string;
  is_primary: boolean;
  relationship_status?: string | null;
  customer_code?: string | null;
  brands:
    | { name: string; slug: string; color: string | null }
    | { name: string; slug: string; color: string | null }[]
    | null;
};

const SELECT_FULL =
  "company_id,brand_id,is_primary,relationship_status,customer_code,brands(name,slug,color)";
const SELECT_WITH_REL =
  "company_id,brand_id,is_primary,relationship_status,brands(name,slug,color)";
const SELECT_BASE = "company_id,brand_id,is_primary,brands(name,slug,color)";

let cachedSelect: string | null = null;
let cachedHasRelationshipStatus: boolean | null = null;

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
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

function nextSelectFallback(current: string): string | null {
  if (current === SELECT_FULL) return SELECT_WITH_REL;
  if (current === SELECT_WITH_REL) return SELECT_BASE;
  if (current.includes("customer_code") && current.includes("relationship_status")) {
    return SELECT_WITH_REL;
  }
  if (current.includes("relationship_status")) return SELECT_BASE;
  return null;
}

function resolveRelationship(
  row: CompanyBrandBatchRow,
  companyCommercialStatus: CommercialStatus | undefined
): BrandRelationshipStatus {
  if (isBrandRelationshipStatus(row.relationship_status)) {
    return row.relationship_status;
  }
  if (cachedHasRelationshipStatus === false && companyCommercialStatus) {
    return commercialStatusToBrandRelationship(companyCommercialStatus) ?? "prospect";
  }
  return "prospect";
}

function mapRow(
  row: CompanyBrandBatchRow,
  commercialByCompanyId?: Map<string, CommercialStatus>
): BrandAssociationView | null {
  const brand = relationOne(row.brands);
  if (!brand?.slug) return null;
  return {
    brand_id: row.brand_id,
    name: brand.name,
    slug: brand.slug,
    color: brand.color,
    is_primary: row.is_primary,
    relationship_status: resolveRelationship(
      row,
      commercialByCompanyId?.get(row.company_id)
    ),
    customer_code: row.customer_code ?? null,
  };
}

/**
 * Carica company_brands in pagine da 1000, ordine stabile company_id,brand_id.
 * Merge per company_id senza overwrite/perdita associazioni.
 */
export async function fetchCompanyBrandsByCompanyIds(
  companyIds: string[],
  options?: {
    commercialByCompanyId?: Map<string, CommercialStatus>;
  }
): Promise<{
  byCompanyId: Map<string, BrandAssociationView[]>;
  error: string | null;
  hasRelationshipStatusColumn: boolean | null;
}> {
  const byCompanyId = new Map<string, BrandAssociationView[]>();
  if (companyIds.length === 0) {
    return { byCompanyId, error: null, hasRelationshipStatusColumn: cachedHasRelationshipStatus };
  }

  const supabase = await createServerClient();
  let select = cachedSelect ?? SELECT_FULL;
  const uniqueIds = Array.from(new Set(companyIds));

  // PostgREST `.in()` ha limiti pratici: chunk id
  const ID_CHUNK = 200;
  for (let i = 0; i < uniqueIds.length; i += ID_CHUNK) {
    const idChunk = uniqueIds.slice(i, i + ID_CHUNK);
    let offset = 0;

    while (true) {
      let pageError: { code?: string; message?: string } | null = null;
      let rows: CompanyBrandBatchRow[] = [];

      for (;;) {
        const { data, error } = await supabase
          .from("company_brands")
          .select(select)
          .in("company_id", idChunk)
          .order("company_id", { ascending: true })
          .order("brand_id", { ascending: true })
          .range(offset, offset + COMPANY_BRANDS_PAGE_SIZE - 1);

        if (!error) {
          cachedSelect = select;
          if (select.includes("relationship_status")) {
            cachedHasRelationshipStatus = true;
          } else if (select === SELECT_BASE) {
            cachedHasRelationshipStatus = false;
          }
          rows = (data ?? []) as unknown as CompanyBrandBatchRow[];
          pageError = null;
          break;
        }

        if (!isMissingColumnError(error)) {
          return {
            byCompanyId: new Map(),
            error: describeDbError(error),
            hasRelationshipStatusColumn: cachedHasRelationshipStatus,
          };
        }

        const fallback = nextSelectFallback(select);
        if (!fallback) {
          return {
            byCompanyId: new Map(),
            error: describeDbError(error),
            hasRelationshipStatusColumn: cachedHasRelationshipStatus,
          };
        }
        select = fallback;
        cachedSelect = select;
        if (select === SELECT_BASE) {
          cachedHasRelationshipStatus = false;
        }
      }

      if (pageError) {
        return {
          byCompanyId: new Map(),
          error: describeDbError(pageError),
          hasRelationshipStatusColumn: cachedHasRelationshipStatus,
        };
      }

      for (const row of rows) {
        const mapped = mapRow(row, options?.commercialByCompanyId);
        if (!mapped) continue;
        const list = byCompanyId.get(row.company_id) ?? [];
        list.push(mapped);
        byCompanyId.set(row.company_id, list);
      }

      if (rows.length < COMPANY_BRANDS_PAGE_SIZE) {
        break;
      }
      offset += COMPANY_BRANDS_PAGE_SIZE;
    }
  }

  for (const [companyId, list] of byCompanyId) {
    byCompanyId.set(companyId, sortBrandAssociations(list));
  }

  return {
    byCompanyId,
    error: null,
    hasRelationshipStatusColumn: cachedHasRelationshipStatus,
  };
}

/**
 * Risolve company_id che matchano slug Brand (OR/AND) via join brands.
 * Paginato, senza N+1.
 */
export async function resolveCompanyIdsForBrandSlugs(input: {
  brandSlugs: string[];
  matchMode?: BrandMatchMode;
}): Promise<{ companyIds: string[] | null; error: string | null }> {
  const slugs = input.brandSlugs.map(normalizeBrandSlug).filter(Boolean);
  if (slugs.length === 0) {
    return { companyIds: null, error: null };
  }

  const supabase = await createServerClient();
  const { data: brandRows, error: brandError } = await supabase
    .from("brands")
    .select("id,slug")
    .in("slug", slugs);

  if (brandError) {
    return { companyIds: null, error: describeDbError(brandError) };
  }

  const brandIds = (brandRows ?? []).map((b) => b.id);
  if (brandIds.length === 0) {
    return { companyIds: [], error: null };
  }

  const mode = input.matchMode ?? "or";
  const slugByBrandId = new Map((brandRows ?? []).map((b) => [b.id, normalizeBrandSlug(b.slug)]));

  // Carica tutte le associazioni per i brand selezionati
  const matchesByCompany = new Map<string, Set<string>>();
  let offset = 0;
  const select = "company_id,brand_id";

  while (true) {
    const { data, error } = await supabase
      .from("company_brands")
      .select(select)
      .in("brand_id", brandIds)
      .order("company_id", { ascending: true })
      .order("brand_id", { ascending: true })
      .range(offset, offset + COMPANY_BRANDS_PAGE_SIZE - 1);

    if (error) {
      return { companyIds: null, error: describeDbError(error) };
    }

    const rows = (data as unknown as Array<{ company_id: string; brand_id: string }> | null) ?? [];
    for (const row of rows) {
      const slug = slugByBrandId.get(row.brand_id);
      if (!slug) continue;
      const set = matchesByCompany.get(row.company_id) ?? new Set();
      set.add(slug);
      matchesByCompany.set(row.company_id, set);
    }

    if (rows.length < COMPANY_BRANDS_PAGE_SIZE) break;
    offset += COMPANY_BRANDS_PAGE_SIZE;
  }

  const selectedSet = new Set(slugs);
  const companyIds: string[] = [];

  for (const [companyId, matchedSlugs] of matchesByCompany) {
    if (mode === "and") {
      if ([...selectedSet].every((s) => matchedSlugs.has(s))) {
        companyIds.push(companyId);
      }
    } else if ([...selectedSet].some((s) => matchedSlugs.has(s))) {
      companyIds.push(companyId);
    }
  }

  return { companyIds, error: null };
}

/**
 * Filtra company_id per Brand + relationship_status (o fallback commercial_status).
 * Usato quando commercial_status UI + brands sono entrambi attivi.
 */
export async function resolveCompanyIdsForBrandAndRelationship(input: {
  brandSlugs: string[];
  commercialStatus: CommercialStatus;
  matchMode?: BrandMatchMode;
  /** commercial_status per azienda (fallback se colonna relationship assente). */
  commercialByCompanyId?: Map<string, CommercialStatus>;
}): Promise<{ companyIds: string[]; error: string | null }> {
  const target = commercialStatusToBrandRelationship(input.commercialStatus);
  if (!target) {
    return { companyIds: [], error: null };
  }

  const slugs = input.brandSlugs.map(normalizeBrandSlug).filter(Boolean);
  if (slugs.length === 0) {
    return { companyIds: [], error: null };
  }

  // Prima ottieni candidati per slug
  const slugResult = await resolveCompanyIdsForBrandSlugs({
    brandSlugs: slugs,
    matchMode: input.matchMode,
  });
  if (slugResult.error) {
    return { companyIds: [], error: slugResult.error };
  }
  const candidateIds = slugResult.companyIds ?? [];
  if (candidateIds.length === 0) {
    return { companyIds: [], error: null };
  }

  // Fallback schema-aware: se relationship_status assente, serve commercial_status azienda.
  let commercialByCompanyId = input.commercialByCompanyId;
  if (!commercialByCompanyId || commercialByCompanyId.size === 0) {
    commercialByCompanyId = new Map();
    const supabase = await createServerClient();
    const ID_CHUNK = 200;
    for (let i = 0; i < candidateIds.length; i += ID_CHUNK) {
      const chunk = candidateIds.slice(i, i + ID_CHUNK);
      const { data, error } = await supabase
        .from("companies")
        .select("id,commercial_status")
        .in("id", chunk);
      if (error) {
        return { companyIds: [], error: describeDbError(error) };
      }
      for (const row of data ?? []) {
        commercialByCompanyId.set(
          row.id,
          (row.commercial_status as CommercialStatus) ?? "prospect"
        );
      }
    }
  }

  const brandsResult = await fetchCompanyBrandsByCompanyIds(candidateIds, {
    commercialByCompanyId,
  });
  if (brandsResult.error) {
    return { companyIds: [], error: brandsResult.error };
  }

  const mode = input.matchMode ?? "or";
  const out: string[] = [];

  for (const companyId of candidateIds) {
    const brands = brandsResult.byCompanyId.get(companyId) ?? [];
    const scoped = brands.filter((b) =>
      slugs.some((s) => normalizeBrandSlug(b.slug) === s)
    );

    if (mode === "and") {
      // Tutti i brand selezionati devono esistere E avere lo status target
      const ok = slugs.every((slug) =>
        scoped.some(
          (b) => normalizeBrandSlug(b.slug) === slug && b.relationship_status === target
        )
      );
      if (ok) out.push(companyId);
    } else {
      // Almeno un brand selezionato con lo status target
      if (scoped.some((b) => b.relationship_status === target)) {
        out.push(companyId);
      }
    }
  }

  return { companyIds: out, error: null };
}

export function getCachedHasRelationshipStatusColumn(): boolean | null {
  return cachedHasRelationshipStatus;
}
