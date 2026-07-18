import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { ProductDetail } from "@/features/products/components/product-detail";
import { listProductCompanyInterests } from "@/features/products/services/company-product-interests.service";
import { getProductById } from "@/features/products/services/products.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dettaglio prodotto" };

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dettaglio prodotto" />
        <EmptyState icon={Package} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const product = await getProductById(id);
  if (!product) {
    notFound();
  }

  const companyLinks = await listProductCompanyInterests(id);

  return (
    <ProductDetail
      product={product}
      companyLinks={companyLinks.data}
      companyLinksError={companyLinks.error}
    />
  );
}
