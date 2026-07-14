"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ProductListItem } from "@/features/products/services/products.service";
import { resetCompaniesPageParam } from "../utils/companies-filter-navigation";

interface PurchasedProductFilterProps {
  products: ProductListItem[];
}

export function PurchasedProductFilter({ products }: PurchasedProductFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("purchased_product") ?? "";

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    const value = event.target.value;

    if (value) {
      params.set("purchased_product", value);
    } else {
      params.delete("purchased_product");
    }

    resetCompaniesPageParam(params);
    const query = params.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      aria-label="Filtra per prodotto acquistato"
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
    >
      <option value="">Qualsiasi acquisto</option>
      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name}
        </option>
      ))}
    </select>
  );
}
