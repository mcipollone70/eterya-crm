/**
 * Aggregazione Brand per marker mappa.
 * Dedup per brand_id (fallback slug); primary first + alfabetico.
 * Merge twin: stessa core name + stesse coordinate → unione associazioni.
 */
import type { MapCompany, MapCompanyBrand } from "../types/map";
import { normalizeMapBrandKey, sortMapCompanyBrands } from "./map-brand-markers";

/** Normalizza nome azienda per matching twin (strip codici finali e forma legale). */
export function coreMapCompanyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // s.r.l. / s.r.l.s / S.R.L → token srl/srls prima di togliere la punteggiatura
    .replace(/\bs\s*\.?\s*r\s*\.?\s*l\s*\.?\s*s\b/g, " srls ")
    .replace(/\bs\s*\.?\s*r\s*\.?\s*l\s*\.?\b/g, " srl ")
    .replace(/\bs\s*\.?\s*p\s*\.?\s*a\s*\.?\b/g, " spa ")
    .replace(/\bs\s*\.?\s*n\s*\.?\s*c\s*\.?\b/g, " snc ")
    .replace(/\bs\s*\.?\s*a\s*\.?\s*s\s*\.?\b/g, " sas ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+\d{3,}$/g, "")
    .replace(
      /\b(srl|srls|spa|snc|sas|ss|soc|cooperativa|unipersonale|semplificata|a responsabilita limitata)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Chiave coordinate stabile per twin geolocalizzati sullo stesso punto. */
export function mapCompanyCoordKey(
  latitude: number,
  longitude: number,
  decimals = 5
): string {
  return `${latitude.toFixed(decimals)},${longitude.toFixed(decimals)}`;
}

/**
 * Dedup associazioni: per brand_id (o slug normalizzato se id assente).
 * Tiene la riga primary se in conflitto, altrimenti la prima vista.
 * Garantisce al più un is_primary dopo merge twin.
 */
export function dedupeMapCompanyBrands(
  brands: MapCompanyBrand[]
): MapCompanyBrand[] {
  const byKey = new Map<string, MapCompanyBrand>();

  for (const brand of brands) {
    const idKey = brand.brand_id?.trim();
    const slugKey = normalizeMapBrandKey(brand.slug || brand.name);
    const key = idKey ? `id:${idKey}` : `slug:${slugKey}`;
    if (!key || key === "id:" || key === "slug:") {
      continue;
    }

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, brand);
      continue;
    }
    if (!existing.is_primary && brand.is_primary) {
      byKey.set(key, brand);
    }
  }

  const ordered = sortMapCompanyBrands(Array.from(byKey.values()));
  let keptPrimary = false;
  return ordered.map((brand) => {
    if (!brand.is_primary) {
      return brand;
    }
    if (!keptPrimary) {
      keptPrimary = true;
      return brand;
    }
    return { ...brand, is_primary: false };
  });
}

/** Unisce liste Brand e deduplica/ordina. Nessuno slice. */
export function aggregateMapCompanyBrands(
  ...lists: Array<MapCompanyBrand[] | undefined | null>
): MapCompanyBrand[] {
  const merged: MapCompanyBrand[] = [];
  for (const list of lists) {
    if (list?.length) {
      merged.push(...list);
    }
  }
  return dedupeMapCompanyBrands(merged);
}

export function twinGroupKeyForMapCompany(
  company: Pick<MapCompany, "name" | "latitude" | "longitude">
): string | null {
  const core = coreMapCompanyName(company.name);
  if (!core || core.length < 3) {
    return null;
  }
  if (!Number.isFinite(company.latitude) || !Number.isFinite(company.longitude)) {
    return null;
  }
  return `${core}|${mapCompanyCoordKey(company.latitude, company.longitude)}`;
}

/**
 * Per twin (stesso core name + stesse coords) unisce TUTTI i Brand
 * su ogni azienda del gruppo. Non tocca aziende senza twin.
 *
 * `offPageTwinBrandsByTwinKey`: brand di twin fuori dalla pagina corrente
 * (stesso twin key), usati solo per l'unione — non aggiungono marker.
 */
export function mergeTwinMapCompanyBrands(
  companies: MapCompany[],
  offPageTwinBrandsByTwinKey?: Map<string, MapCompanyBrand[]>
): MapCompany[] {
  const groups = new Map<string, string[]>();

  for (const company of companies) {
    const key = twinGroupKeyForMapCompany(company);
    if (!key) {
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(company.id);
    groups.set(key, list);
  }

  const brandsById = new Map(
    companies.map((company) => [company.id, company.brands ?? []] as const)
  );

  const unionByCompanyId = new Map<string, MapCompanyBrand[]>();
  for (const [twinKey, ids] of groups) {
    const offPage = offPageTwinBrandsByTwinKey?.get(twinKey) ?? [];
    if (ids.length < 2 && offPage.length === 0) {
      continue;
    }
    const union = aggregateMapCompanyBrands(
      ...ids.map((id) => brandsById.get(id) ?? []),
      offPage
    );
    for (const id of ids) {
      unionByCompanyId.set(id, union);
    }
  }

  if (unionByCompanyId.size === 0) {
    return companies.map((company) => ({
      ...company,
      brands: dedupeMapCompanyBrands(company.brands ?? []),
    }));
  }

  return companies.map((company) => ({
    ...company,
    brands:
      unionByCompanyId.get(company.id) ??
      dedupeMapCompanyBrands(company.brands ?? []),
  }));
}

/**
 * Unione Brand per cache client: mai sostituire un set più ricco con uno più povero.
 * Dedup per brand_id / slug.
 */
export function unionMapCompanyBrandCaches(
  existing: MapCompanyBrand[] | undefined | null,
  incoming: MapCompanyBrand[] | undefined | null
): MapCompanyBrand[] {
  return aggregateMapCompanyBrands(existing, incoming);
}

/**
 * Merge batch di associazioni paginate: append per company_id, mai overwrite.
 */
export function mergePaginatedCompanyBrandBatches(
  batches: Array<Array<{ company_id: string; brand: MapCompanyBrand }>>,
  expectedAssociationCount?: number
): {
  byCompanyId: Map<string, MapCompanyBrand[]>;
  associationCount: number;
  countMatchesExpected: boolean | null;
} {
  const byCompanyId = new Map<string, MapCompanyBrand[]>();
  let associationCount = 0;

  for (const batch of batches) {
    for (const row of batch) {
      const list = byCompanyId.get(row.company_id) ?? [];
      list.push(row.brand);
      byCompanyId.set(row.company_id, list);
      associationCount += 1;
    }
  }

  for (const [companyId, list] of byCompanyId) {
    byCompanyId.set(companyId, dedupeMapCompanyBrands(list));
  }

  return {
    byCompanyId,
    associationCount,
    countMatchesExpected:
      expectedAssociationCount == null
        ? null
        : associationCount === expectedAssociationCount,
  };
}

/** Page size PostgREST-safe per company_brands / companies. */
export const MAP_COMPANY_BRANDS_PAGE_SIZE = 1000;

/**
 * Accumula pagine con range stabile.
 * - pageSize fisso (default 1000)
 * - stop quando rows.length < pageSize
 * - FAIL immediato su errore pagina (niente continue silenzioso / overwrite)
 */
export async function accumulateStablePagedRows<T>(options: {
  pageSize?: number;
  fetchPage: (
    from: number,
    to: number
  ) => Promise<{ rows: T[]; error: string | null }>;
}): Promise<{ rows: T[]; error: string | null; pageCount: number }> {
  const pageSize = options.pageSize ?? MAP_COMPANY_BRANDS_PAGE_SIZE;
  if (pageSize < 1) {
    return { rows: [], error: "pageSize must be >= 1", pageCount: 0 };
  }

  const rows: T[] = [];
  let pageFrom = 0;
  let pageCount = 0;

  while (true) {
    const { rows: page, error } = await options.fetchPage(
      pageFrom,
      pageFrom + pageSize - 1
    );
    pageCount += 1;
    if (error) {
      return { rows: [], error, pageCount };
    }
    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
    pageFrom += pageSize;
  }

  return { rows, error: null, pageCount };
}
