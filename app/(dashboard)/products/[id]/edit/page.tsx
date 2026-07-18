import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { EditProductForm } from "@/features/products/components/edit-product-form";
import { getProductById } from "@/features/products/services/products.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifica prodotto" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Modifica prodotto" />
        <EmptyState icon={Package} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const product = await getProductById(id);
  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Modifica prodotto" subtitle={product.name} />
      <EditProductForm product={product} />
    </div>
  );
}
