/**
 * Logica Brand condivisa (aziende, contatti, mappa, marker, popup, scheda).
 * Slug ufficiali come id tecnici — mai il display name.
 */
import { BRAND_RELATIONSHIP_STATUS_LABELS } from "@/lib/constants/brand-relationship";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import type { BrandRelationshipStatus, CommercialStatus } from "@/lib/supabase/types";

/** Slug ufficiali (brands.slug). */
export const OFFICIAL_BRAND_SLUGS = [
  "eterya",
  "zanzar",
  "palagina",
  "tempra-glass",
] as const;

export type OfficialBrandSlug = (typeof OFFICIAL_BRAND_SLUGS)[number];

export const BRAND_INITIAL_BY_SLUG: Record<string, string> = {
  zanzar: "Z",
  palagina: "P",
  eterya: "E",
  "tempra-glass": "T",
};

export const BRAND_MATCH_MODES = ["or", "and"] as const;
export type BrandMatchMode = (typeof BRAND_MATCH_MODES)[number];

export const DEFAULT_BRAND_MATCH_MODE: BrandMatchMode = "or";

/** Associazione minima per filtri e badge. */
export interface BrandAssociationView {
  brand_id: string;
  name: string;
  slug: string;
  color: string | null;
  is_primary: boolean;
  relationship_status: BrandRelationshipStatus;
  customer_code?: string | null;
}

/** Normalizza slug/name: lowercase, spazi/underscore → trattino. */
export function normalizeBrandSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isOfficialBrandSlug(value: string): value is OfficialBrandSlug {
  return (OFFICIAL_BRAND_SLUGS as readonly string[]).includes(normalizeBrandSlug(value));
}

export function resolveBrandInitial(
  brand: Pick<BrandAssociationView, "slug" | "name">
): string {
  const slugKey = normalizeBrandSlug(brand.slug);
  if (BRAND_INITIAL_BY_SLUG[slugKey]) {
    return BRAND_INITIAL_BY_SLUG[slugKey];
  }
  const nameKey = normalizeBrandSlug(brand.name);
  if (BRAND_INITIAL_BY_SLUG[nameKey]) {
    return BRAND_INITIAL_BY_SLUG[nameKey];
  }
  const first = brand.name.trim().charAt(0).toUpperCase();
  return first || "?";
}

/** Ordine stabile: primario prima, poi name alfabetico (it). */
export function sortBrandAssociations<T extends BrandAssociationView>(brands: T[]): T[] {
  return [...brands].sort((left, right) => {
    if (left.is_primary !== right.is_primary) {
      return left.is_primary ? -1 : 1;
    }
    return left.name.localeCompare(right.name, "it", { sensitivity: "base" });
  });
}

export function commercialStatusToBrandRelationship(
  status: CommercialStatus
): BrandRelationshipStatus | null {
  switch (status) {
    case "cliente":
      return "customer";
    case "prospect":
      return "prospect";
    case "ex_cliente":
      return "former_customer";
    default:
      return null;
  }
}

export function brandRelationshipToCommercialStatus(
  status: BrandRelationshipStatus
): CommercialStatus {
  switch (status) {
    case "customer":
      return "cliente";
    case "former_customer":
      return "ex_cliente";
    case "prospect":
    default:
      return "prospect";
  }
}

export function formatBrandRelationshipLabel(status: BrandRelationshipStatus): string {
  return BRAND_RELATIONSHIP_STATUS_LABELS[status];
}

/**
 * Parse URL `brands=eterya,zanzar` → slug normalizzati unici.
 * Ignora valori vuoti / sconosciuti non ufficiali solo se strict=false (default: tiene tutti normalizzati).
 */
export function parseBrandsUrlParam(
  raw: string | null | undefined,
  options?: { officialOnly?: boolean }
): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const slug = normalizeBrandSlug(part);
    if (!slug || seen.has(slug)) continue;
    if (options?.officialOnly && !isOfficialBrandSlug(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

export function serializeBrandsUrlParam(slugs: string[]): string {
  const unique = parseBrandsUrlParam(slugs.join(","));
  return unique.join(",");
}

export function parseBrandMatchMode(raw: string | null | undefined): BrandMatchMode {
  return raw === "and" ? "and" : "or";
}

/** Match Brand: OR = almeno uno; AND = tutti i selezionati. */
export function companyMatchesBrandSlugs(
  brands: Array<Pick<BrandAssociationView, "slug">>,
  selectedSlugs: string[],
  mode: BrandMatchMode = DEFAULT_BRAND_MATCH_MODE
): boolean {
  if (selectedSlugs.length === 0) return true;
  const owned = new Set(brands.map((b) => normalizeBrandSlug(b.slug)));
  const selected = selectedSlugs.map(normalizeBrandSlug).filter(Boolean);
  if (selected.length === 0) return true;
  if (mode === "and") {
    return selected.every((slug) => owned.has(slug));
  }
  return selected.some((slug) => owned.has(slug));
}

/**
 * Filtro relazione commerciale brand-aware.
 * Con Brand: match se ALMENO un brand (tra quelli in scope) ha relationship_status target.
 * Senza Brand: usa commercial_status legacy azienda.
 *
 * Scope brand: se selectedSlugs non vuoto, valuta solo quelle associazioni
 * (es. Clienti ETERYA ≠ Clienti ZANZAR su multibrand misto).
 */
export function companyMatchesBrandRelationshipFilter(
  brands: Array<Pick<BrandAssociationView, "slug" | "relationship_status">>,
  commercialStatus: CommercialStatus,
  selectedBrandSlugs: string[] = []
): boolean {
  const target = commercialStatusToBrandRelationship(commercialStatus);
  if (target == null) {
    return false;
  }

  if (brands.length === 0) {
    return false;
  }

  const scope =
    selectedBrandSlugs.length > 0
      ? brands.filter((b) =>
          selectedBrandSlugs.some(
            (slug) => normalizeBrandSlug(slug) === normalizeBrandSlug(b.slug)
          )
        )
      : brands;

  if (scope.length === 0) {
    return false;
  }

  return scope.some((brand) => brand.relationship_status === target);
}

/**
 * Combinazione Brand + stato commerciale + modalità OR/AND.
 * - Solo Brand → match slug
 * - Solo stato senza Brand → caller gestisce legacy commercial_status
 * - Brand + stato → slug match AND relationship sul subset filtrato
 */
export function companyMatchesBrandFilters(input: {
  brands: Array<Pick<BrandAssociationView, "slug" | "relationship_status">>;
  selectedSlugs: string[];
  matchMode?: BrandMatchMode;
  commercialStatus?: CommercialStatus | null | "";
  /** Fallback se brands vuoto e commercialStatus impostato. */
  legacyCommercialStatus?: CommercialStatus | null;
}): boolean {
  const mode = input.matchMode ?? DEFAULT_BRAND_MATCH_MODE;
  const selected = input.selectedSlugs.map(normalizeBrandSlug).filter(Boolean);
  const rawStatus = input.commercialStatus;
  const status: CommercialStatus | null =
    rawStatus && (rawStatus as string) !== ""
      ? (rawStatus as CommercialStatus)
      : null;

  if (selected.length === 0) {
    if (!status) return true;
    if (input.brands.length > 0) {
      return companyMatchesBrandRelationshipFilter(input.brands, status, []);
    }
    return input.legacyCommercialStatus === status;
  }

  if (!companyMatchesBrandSlugs(input.brands, selected, mode)) {
    return false;
  }

  if (!status) {
    return true;
  }

  if (mode === "and") {
    const target = commercialStatusToBrandRelationship(status);
    if (target == null) return false;
    return selected.every((slug) =>
      input.brands.some(
        (b) =>
          normalizeBrandSlug(b.slug) === slug && b.relationship_status === target
      )
    );
  }

  return companyMatchesBrandRelationshipFilter(input.brands, status, selected);
}

export function resolvePrimaryBrandRelationship(
  brands: BrandAssociationView[]
): BrandRelationshipStatus | null {
  const ordered = sortBrandAssociations(brands);
  if (ordered.length === 0) return null;
  return (
    ordered.find((b) => b.is_primary)?.relationship_status ??
    ordered[0]?.relationship_status ??
    null
  );
}

export function resolveCompanyRelationshipLabel(
  brands: BrandAssociationView[],
  legacyCommercialStatus: CommercialStatus
): string {
  const primary = resolvePrimaryBrandRelationship(brands);
  if (primary) {
    return formatBrandRelationshipLabel(primary);
  }
  return COMMERCIAL_STATUS_LABELS[legacyCommercialStatus];
}

/** Page size PostgREST-safe per company_brands. */
export const COMPANY_BRANDS_PAGE_SIZE = 1000;
