import { Suspense } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { Badge, Card, CardContent, EmptyState, PageHeader, PageLoadingSkeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseProductCatalogFilters } from "@/lib/constants/product-filters";
import {
  PRODUCT_FAMILY_LABELS,
  formatPriceRange,
} from "@/lib/constants/product-catalog";
import { ProductFiltersBar } from "./components/product-filters-bar";
import { NewProductForm } from "./components/new-product-form";
import { getProductCatalogSummary, listProducts } from "./services/products.service";

interface ProductsPageProps {
  family?: string;
  active?: string;
  q?: string;
}

export async function ProductsPage({ family, active, q }: ProductsPageProps) {
  const filters = parseProductCatalogFilters({ family, active, q });

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Catalogo Prodotti" subtitle="Famiglie e listino prodotti." />
        <EmptyState
          icon={Package}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire il catalogo prodotti."
        />
      </div>
    );
  }

  const [productsResult, summaryResult] = await Promise.all([
    listProducts({
      family: filters.family,
      active: filters.active,
      query: filters.query,
    }),
    getProductCatalogSummary(),
  ]);

  const { data: products, error } = productsResult;
  const summary = summaryResult.data;

  const grouped = products.reduce<Record<string, typeof products>>((acc, product) => {
    const key = product.family;
    acc[key] = acc[key] ?? [];
    acc[key].push(product);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogo Prodotti"
        subtitle={`${products.length.toLocaleString("it-IT")} prodotti visualizzati · ${summary.active} attivi su ${summary.total}`}
        actions={<NewProductForm />}
      />

      {summary.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.byFamily).map(([familyKey, count]) => (
            <span
              key={familyKey}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
            >
              {PRODUCT_FAMILY_LABELS[familyKey as keyof typeof PRODUCT_FAMILY_LABELS] ?? familyKey}
              <span className="ml-1.5 font-medium text-slate-900">{count}</span>
            </span>
          ))}
        </div>
      )}

      <Suspense fallback={<PageLoadingSkeleton rows={1} />}>
        <ProductFiltersBar />
      </Suspense>

      {error ? (
        <EmptyState icon={Package} title="Impossibile caricare il catalogo" message={error} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nessun prodotto trovato"
          message="Aggiungi un prodotto al catalogo oppure reimposta i filtri di ricerca."
        />
      ) : (
        Object.entries(grouped).map(([familyKey, items]) => (
          <Card key={familyKey}>
            <CardContent className="p-0">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {PRODUCT_FAMILY_LABELS[familyKey as keyof typeof PRODUCT_FAMILY_LABELS] ?? familyKey}
                </h3>
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((product) => (
                  <li
                    key={product.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 hover:bg-slate-50/80"
                  >
                    <div>
                      <Link
                        href={`/products/${product.id}`}
                        className="text-sm font-semibold text-indigo-700 hover:underline"
                      >
                        {product.name}
                      </Link>
                      {product.description && (
                        <p className="mt-1 text-xs text-slate-500">{product.description}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-600">
                        Fascia: {formatPriceRange(product.price_range_min, product.price_range_max)}
                      </p>
                      {product.notes && <p className="mt-1 text-xs text-slate-500">{product.notes}</p>}
                    </div>
                    <Badge variant={product.is_active ? "success" : "muted"}>
                      {product.is_active ? "Attivo" : "Non attivo"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
