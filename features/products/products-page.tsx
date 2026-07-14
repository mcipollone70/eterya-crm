import { Package } from "lucide-react";
import { Badge, Card, CardContent, EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  PRODUCT_FAMILY_LABELS,
  formatPriceRange,
} from "@/lib/constants/product-catalog";
import { listProducts } from "./services/products.service";
import { NewProductForm } from "./components/new-product-form";

export async function ProductsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Prodotti" subtitle="Catalogo prodotti e famiglie." />
        <EmptyState
          icon={Package}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire il catalogo prodotti."
        />
      </div>
    );
  }

  const { data: products, error } = await listProducts();

  const grouped = products.reduce<Record<string, typeof products>>((acc, product) => {
    const key = product.family;
    acc[key] = acc[key] ?? [];
    acc[key].push(product);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prodotti"
        subtitle={`${products.length.toLocaleString("it-IT")} prodotti nel catalogo.`}
        actions={<NewProductForm />}
      />

      {error ? (
        <EmptyState icon={Package} title="Impossibile caricare i prodotti" message={error} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Catalogo vuoto"
          message="Aggiungi il primo prodotto al catalogo."
        />
      ) : (
        Object.entries(grouped).map(([family, items]) => (
          <Card key={family}>
            <CardContent className="p-0">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {PRODUCT_FAMILY_LABELS[family as keyof typeof PRODUCT_FAMILY_LABELS] ?? family}
                </h3>
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((product) => (
                  <li key={product.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{product.name}</p>
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
