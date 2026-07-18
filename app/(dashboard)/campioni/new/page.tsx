import { Boxes } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { SampleForm } from "@/features/samples";
import { listProducts } from "@/features/products/services/products.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuovo campione" };

export default async function NewSamplePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Nuovo campione" />
        <EmptyState icon={Boxes} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const productsResult = await listProducts({ activeOnly: true });

  return (
    <div className="space-y-6">
      <PageHeader title="Nuovo campione" subtitle="Registra un campione consegnato a un'azienda." />
      <SampleForm products={productsResult.data ?? []} initialCompanyId={company} />
    </div>
  );
}
