import { LifeBuoy } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { ServiceTicketForm } from "@/features/service";
import { listProducts } from "@/features/products/services/products.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuovo ticket assistenza" };

export default async function NewServiceTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; order?: string }>;
}) {
  const { company, order } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Nuovo ticket assistenza" />
        <EmptyState icon={LifeBuoy} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const productsResult = await listProducts({ activeOnly: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuovo ticket assistenza"
        subtitle="Apri un intervento di assistenza post-vendita."
      />
      <ServiceTicketForm
        products={productsResult.data ?? []}
        initialCompanyId={company}
        initialOrderId={order}
      />
    </div>
  );
}
