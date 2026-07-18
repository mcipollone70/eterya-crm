export const dynamic = "force-dynamic";

import { ProductsPage } from "@/features/products";
import { isProductFamily } from "@/lib/constants/product-catalog";

export const metadata = { title: "Catalogo Prodotti" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    family?: string;
    active?: string;
    q?: string;
  }>;
}) {
  const { family, active, q } = await searchParams;

  return (
    <ProductsPage
      family={isProductFamily(family) ? family : undefined}
      active={active}
      q={q}
    />
  );
}
