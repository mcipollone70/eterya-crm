import { BRAND_RELATIONSHIP_STATUS_LABELS } from "@/lib/constants/brand-relationship";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import type { BrandRelationshipStatus, CommercialStatus } from "@/lib/supabase/types";
import { COMMERCIAL_STATUS_MARKER_COLORS } from "../constants/map-config";
import type { MapCompany, MapCompanyBrand } from "../types/map";
import {
  BRAND_INITIAL_BY_SLUG,
  brandRelationshipToCommercialStatus as sharedRelToCommercial,
  commercialStatusToBrandRelationship as sharedCommercialToRel,
  normalizeBrandSlug,
  resolveBrandInitial,
  sortBrandAssociations,
} from "@/features/brands/utils/brand-shared";

/**
 * Iniziali marker mappa (stabili, non usano short_code DB tipo ZNZ/PLG).
 * Ordine lettere sul marker: brand primario per primo, poi alfabetico per name.
 * Lookup case-insensitive; slug/name accettano spazi, underscore e trattini.
 */
export const MAP_BRAND_INITIAL_BY_SLUG: Record<string, string> = { ...BRAND_INITIAL_BY_SLUG };

export const MAP_BRAND_LEGEND_ITEMS = [
  { initial: "Z", label: "ZANZAR" },
  { initial: "P", label: "PALAGINA" },
  { initial: "E", label: "ETERYA" },
  { initial: "T", label: "TEMPRA GLASS" },
] as const;

export const MAP_MULTI_BRAND_CROWN_LABEL = "Azienda servita da più marchi";

/** Soglia da cui compare la corona multi-brand (4+ marchi). */
export const MAP_MULTI_BRAND_CROWN_THRESHOLD = 4;

/**
 * Nessun troncamento iniziali: 0/1/2/3/4 brand → tutte le lettere.
 * Costante tenuta per compatibilità test/documentazione (soglia = illimitata pratica).
 */
export const MAP_MULTI_BRAND_VISIBLE_INITIALS = Number.POSITIVE_INFINITY;

/** Normalizza slug/name per match case-insensitive (spazi/underscore → trattino). */
export function normalizeMapBrandKey(value: string): string {
  return normalizeBrandSlug(value);
}

export function resolveMapBrandInitial(brand: Pick<MapCompanyBrand, "slug" | "name">): string {
  return resolveBrandInitial(brand);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Marker neutro (azienda senza Brand): cerchio colorato, nessuna lettera. */
export function buildNeutralMarkerIconHtml(fillColor: string): string {
  return `
    <div style="width:16px;height:16px;border-radius:9999px;background:${escapeHtml(fillColor)};border:2px solid #ffffff;box-shadow:0 1px 4px rgba(15,23,42,0.35);"></div>
  `.trim();
}

/**
 * Ordine stabile: is_primary=true per primo, poi name alfabetico (it).
 */
export function sortMapCompanyBrands(brands: MapCompanyBrand[]): MapCompanyBrand[] {
  return sortBrandAssociations(brands);
}

/** Mappa commercial_status legacy → relationship_status Brand (e viceversa). */
export function commercialStatusToBrandRelationship(
  status: CommercialStatus
): BrandRelationshipStatus | null {
  return sharedCommercialToRel(status);
}

export function brandRelationshipToCommercialStatus(
  status: BrandRelationshipStatus
): CommercialStatus {
  return sharedRelToCommercial(status);
}

/**
 * Relazione primaria usata da marker + popup (stessa fonte).
 * Con Brand: relationship_status del primario (o primo ordinato).
 * Senza Brand: null → il caller usa commercial_status.
 */
export function resolveMapCompanyPrimaryRelationship(
  company: Pick<MapCompany, "brands">
): BrandRelationshipStatus | null {
  const ordered = sortMapCompanyBrands(company.brands ?? []);
  if (ordered.length === 0) {
    return null;
  }
  return (
    ordered.find((brand) => brand.is_primary)?.relationship_status ??
    ordered[0]?.relationship_status ??
    null
  );
}

/** Colore stato marker: Brand relationship se presente, altrimenti commercial_status. */
export function resolveMapCompanyStatusMarkerColor(company: MapCompany): string {
  const primaryRel = resolveMapCompanyPrimaryRelationship(company);
  const status: CommercialStatus = primaryRel
    ? brandRelationshipToCommercialStatus(primaryRel)
    : company.commercial_status;
  return COMMERCIAL_STATUS_MARKER_COLORS[status];
}

/** Etichetta Relazione coerente tra marker e popup. */
export function resolveMapCompanyRelationshipLabel(company: MapCompany): string {
  const primaryRel = resolveMapCompanyPrimaryRelationship(company);
  if (primaryRel) {
    return BRAND_RELATIONSHIP_STATUS_LABELS[primaryRel];
  }
  return COMMERCIAL_STATUS_LABELS[company.commercial_status];
}

/**
 * Filtro Cliente/Prospect/Ex: con Brand usa relationship_status;
 * senza Brand usa commercial_status legacy.
 */
export function companyMatchesMapCommercialStatusFilter(
  company: Pick<MapCompany, "brands" | "commercial_status">,
  filter: CommercialStatus
): boolean {
  const brands = company.brands ?? [];
  if (brands.length === 0) {
    return company.commercial_status === filter;
  }

  const target = commercialStatusToBrandRelationship(filter);
  if (target == null) {
    return false;
  }

  return brands.some((brand) => brand.relationship_status === target);
}

export interface MapBrandMarkerVisual {
  initials: string;
  showCrown: boolean;
  /** Colore fill del brand primario (o primo alfabetico). null = marker neutro. */
  color: string | null;
  orderedBrands: MapCompanyBrand[];
}

export function resolveMapBrandMarkerVisual(
  brands: MapCompanyBrand[] | undefined | null
): MapBrandMarkerVisual {
  const orderedBrands = sortMapCompanyBrands(brands ?? []);

  if (orderedBrands.length === 0) {
    return { initials: "", showCrown: false, color: null, orderedBrands };
  }

  const showCrown = orderedBrands.length >= MAP_MULTI_BRAND_CROWN_THRESHOLD;
  // Mai troncare: tutte le iniziali di tutti i Brand nel payload.
  const initials = orderedBrands.map((brand) => resolveMapBrandInitial(brand)).join("");

  const primary =
    orderedBrands.find((brand) => brand.is_primary) ??
    [...orderedBrands].sort((a, b) =>
      a.name.localeCompare(b.name, "it", { sensitivity: "base" })
    )[0];

  const color = primary.color?.trim() || null;

  return { initials, showCrown, color, orderedBrands };
}

export function formatBrandRelationshipLabel(
  status: BrandRelationshipStatus
): string {
  return BRAND_RELATIONSHIP_STATUS_LABELS[status];
}

export interface BrandMarkerIconMetrics {
  width: number;
  height: number;
  fontSize: number;
  iconSize: [number, number];
  iconAnchor: [number, number];
  popupAnchor: [number, number];
}

/**
 * Dimensioni dinamiche marker Brand.
 * Altezza pill 32 → capsule curva ~16px per lato: 3 lettere richiedono
 * larghezza ≥60px altrimenti la terza viene clipata da iconSize/border-radius.
 */
export function resolveBrandMarkerIconMetrics(
  initials: string,
  showCrown: boolean
): BrandMarkerIconMetrics {
  const letterCount = Math.max(1, initials.length);
  // 1→32, 2→44, 3→62, 4→76, oltre scala (nessun troncamento lettere).
  const width =
    letterCount <= 1
      ? 32
      : letterCount === 2
        ? 44
        : letterCount === 3
          ? 62
          : letterCount === 4
            ? 76
            : Math.min(140, 76 + (letterCount - 4) * 12);
  const height = showCrown ? 48 : 32;
  const fontSize =
    letterCount >= 4 ? 12 : letterCount === 3 ? 13 : letterCount === 2 ? 14 : 15;

  return {
    width,
    height,
    fontSize,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
    popupAnchor: [0, -height / 2],
  };
}

export function buildBrandMarkerIconHtml(visual: MapBrandMarkerVisual, fillColor: string): string {
  const metrics = resolveBrandMarkerIconMetrics(visual.initials, visual.showCrown);
  const { width, height, fontSize } = metrics;

  const crown = visual.showCrown
    ? `<span style="position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:12px;line-height:1;z-index:3;pointer-events:none;filter:drop-shadow(0 0 1px #00000055);" aria-hidden="true">👑</span>`
    : "";

  // Una span per lettera: evita clip text-overflow / substring accidentali.
  const letterChars = (visual.initials || "·").split("");
  const letters = letterChars
    .map(
      (ch) =>
        `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:0.62em;flex:0 0 auto;line-height:1;">${escapeHtml(ch)}</span>`
    )
    .join("");

  return `
    <div style="position:relative;width:${width}px;height:${height}px;overflow:visible;display:flex;align-items:flex-end;justify-content:center;box-sizing:border-box;">
      ${crown}
      <div style="box-sizing:border-box;width:${width}px;height:32px;padding:0 8px;border-radius:9999px;background:${escapeHtml(fillColor)};border:2px solid #ffffff;box-shadow:0 1px 4px rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;gap:1px;color:#ffffff;font-weight:700;font-size:${fontSize}px;letter-spacing:0;font-family:system-ui,-apple-system,sans-serif;line-height:1;text-align:center;white-space:nowrap;overflow:visible;">
        ${letters}
      </div>
    </div>
  `.trim();
}

export function buildMapCompanyPopupHtml(company: MapCompany): string {
  const visual = resolveMapBrandMarkerVisual(company.brands);
  const relationshipLabel = resolveMapCompanyRelationshipLabel(company);
  // data-status: stessa fonte del colore marker (test/verifica coerenza)
  const primaryRel = resolveMapCompanyPrimaryRelationship(company);
  const statusKey = primaryRel
    ? brandRelationshipToCommercialStatus(primaryRel)
    : company.commercial_status;

  const brandRows =
    visual.orderedBrands.length === 0
      ? `<p class="text-slate-500">Nessun marchio associato</p>`
      : `<ul class="m-0 list-none space-y-1 p-0">${visual.orderedBrands
          .map((brand) => {
            const initial = resolveMapBrandInitial(brand);
            const rel = formatBrandRelationshipLabel(brand.relationship_status);
            const primaryBadge = brand.is_primary
              ? ` <span style="display:inline-block;margin-left:4px;padding:1px 6px;border-radius:9999px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:600;">Principale</span>`
              : "";
            const weight = brand.is_primary ? "700" : "500";
            return `<li style="font-weight:${weight};" data-brand-slug="${escapeHtml(brand.slug)}" data-brand-status="${escapeHtml(brand.relationship_status)}">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-right:6px;border-radius:9999px;background:${escapeHtml(brand.color ?? "#64748b")};color:#fff;font-size:10px;font-weight:700;">${escapeHtml(initial)}</span>
              ${escapeHtml(brand.name)}${primaryBadge}
              <span style="display:block;margin-left:24px;font-size:11px;font-weight:400;color:#64748b;">${escapeHtml(rel)}</span>
            </li>`;
          })
          .join("")}</ul>`;

  return `
    <div class="space-y-2 text-sm text-slate-800" data-map-status="${escapeHtml(statusKey)}">
      <p class="font-semibold">${escapeHtml(company.name)}</p>
      <div>
        <p class="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Brand</p>
        ${brandRows}
      </div>
      <p><span class="text-slate-500">Relazione:</span> <strong data-relationship-label="1">${escapeHtml(relationshipLabel)}</strong></p>
      <div class="flex flex-col gap-1 pt-1">
        <a href="/companies/${company.id}" class="font-medium text-indigo-600 hover:underline">
          Apri scheda azienda
        </a>
      </div>
    </div>
  `;
}
