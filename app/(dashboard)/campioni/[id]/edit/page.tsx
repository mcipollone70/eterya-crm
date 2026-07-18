import { notFound } from "next/navigation";
import { Boxes } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { SampleForm } from "@/features/samples";
import { getSampleById } from "@/features/samples/services/samples.service";
import { listProducts } from "@/features/products/services/products.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifica campione" };

export default async function EditSamplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Modifica campione" />
        <EmptyState icon={Boxes} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const sample = await getSampleById(id);
  if (!sample) {
    notFound();
  }

  const productsResult = await listProducts({ activeOnly: true });

  return (
    <div className="space-y-6">
      <PageHeader title="Modifica campione" subtitle={sample.title} />
      <SampleForm sample={sample} products={productsResult.data ?? []} />
    </div>
  );
}
