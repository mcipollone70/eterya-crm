import "server-only";

import { listProducts, getProductCatalogSummary } from "@/features/products/services/products.service";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyProductCatalogSnapshot {
  totalProducts: number;
  activeProducts: number;
  families: Array<{ family: string; label: string; count: number }>;
  sampleProducts: Array<{ id: string; name: string; family: string; isActive: boolean }>;
}

export async function getProductCatalog(): Promise<JoyToolResult<JoyProductCatalogSnapshot | null>> {
  try {
    const [summaryResult, productsResult] = await Promise.all([
      getProductCatalogSummary(),
      listProducts({ activeOnly: true }),
    ]);

    if (summaryResult.error) {
      return emptyToolResult(null, summaryResult.error);
    }

    const families = Object.entries(summaryResult.data.byFamily).map(([family, count]) => ({
      family,
      label: PRODUCT_FAMILY_LABELS[family as keyof typeof PRODUCT_FAMILY_LABELS] ?? family,
      count,
    }));

    return successToolResult({
      totalProducts: summaryResult.data.total,
      activeProducts: summaryResult.data.active,
      families,
      sampleProducts: (productsResult.data ?? []).slice(0, 8).map((item) => ({
        id: item.id,
        name: item.name,
        family: PRODUCT_FAMILY_LABELS[item.family],
        isActive: item.is_active,
      })),
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare il catalogo prodotti."
    );
  }
}
