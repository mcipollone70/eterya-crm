import { isProductFamily, type ProductFamily } from "./product-catalog";

export interface ProductCatalogFilters {
  family?: ProductFamily;
  active?: boolean;
  query?: string;
}

export function parseProductCatalogFilters(input: {
  family?: string;
  active?: string;
  q?: string;
}): ProductCatalogFilters {
  const filters: ProductCatalogFilters = {};

  if (isProductFamily(input.family)) {
    filters.family = input.family;
  }

  if (input.active === "true") {
    filters.active = true;
  } else if (input.active === "false") {
    filters.active = false;
  }

  if (input.q?.trim()) {
    filters.query = input.q.trim();
  }

  return filters;
}

export const PRODUCT_ACTIVE_OPTIONS = [
  { value: "", label: "Tutti" },
  { value: "true", label: "Solo attivi" },
  { value: "false", label: "Solo non attivi" },
] as const;
