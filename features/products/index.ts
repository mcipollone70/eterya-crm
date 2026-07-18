/** Products module — catalogo e interessi azienda. */
export const PRODUCTS_MODULE = "products" as const;

export { ProductsPage } from "./products-page";
export { saveProductAction, updateProductAction, addCompanyProductAction } from "./actions/product-actions";
export {
  listProducts,
  getProductById,
  saveProduct,
  updateProduct,
  getProductCatalogSummary,
  getProductDashboardMetrics,
  type ProductListItem,
  type ProductFamilyDashboardMetrics,
} from "./services/products.service";
export {
  listCompanyProductInterests,
  listCompanyProductInterestHistory,
  addCompanyProductInterest,
  resolveCompanyIdsForProductFilters,
  type CompanyProductInterestItem,
} from "./services/company-product-interests.service";
