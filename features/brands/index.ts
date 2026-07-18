export {
  listBrands,
  getBrandById,
  getBrandBySlug,
  type Brand,
} from "./services/brands.service";

export {
  listCompanyBrands,
  getCompanyBrand,
  addCompanyBrand,
  updateCompanyBrand,
  setPrimaryCompanyBrand,
  removeCompanyBrand,
  getCompanyBrandsSchemaCapabilities,
  type CompanyBrandItem,
  type AddCompanyBrandInput,
  type UpdateCompanyBrandInput,
} from "./services/company-brands.service";

export {
  fetchCompanyBrandsByCompanyIds,
  resolveCompanyIdsForBrandSlugs,
  resolveCompanyIdsForBrandAndRelationship,
  type BrandAssociationView,
} from "./services/company-brands-batch.service";

export {
  OFFICIAL_BRAND_SLUGS,
  BRAND_INITIAL_BY_SLUG,
  DEFAULT_BRAND_MATCH_MODE,
  COMPANY_BRANDS_PAGE_SIZE,
  normalizeBrandSlug,
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
  type BrandMatchMode,
} from "./utils/brand-shared";

export { BrandFilter, BrandMultiSelect, type BrandFilterOption } from "./components/brand-filter";
export { BrandBadges } from "./components/brand-badges";
export { CompanyBrandsPanel } from "./components/company-brands-panel";
