/**
 * Logica Brand condivisa (aziende, contatti, mappa, marker, popup, scheda).
 * Slug ufficiali come id tecnici — mai il display name.
 */
export {
  OFFICIAL_BRAND_SLUGS,
  BRAND_INITIAL_BY_SLUG,
  BRAND_MATCH_MODES,
  DEFAULT_BRAND_MATCH_MODE,
  COMPANY_BRANDS_PAGE_SIZE,
  normalizeBrandSlug,
  isOfficialBrandSlug,
  resolveBrandInitial,
  sortBrandAssociations,
  commercialStatusToBrandRelationship,
  brandRelationshipToCommercialStatus,
  formatBrandRelationshipLabel,
  parseBrandsUrlParam,
  serializeBrandsUrlParam,
  parseBrandMatchMode,
  companyMatchesBrandSlugs,
  companyMatchesBrandRelationshipFilter,
  companyMatchesBrandFilters,
  resolvePrimaryBrandRelationship,
  resolveCompanyRelationshipLabel,
  type OfficialBrandSlug,
  type BrandMatchMode,
  type BrandAssociationView,
} from "./brand-shared";
