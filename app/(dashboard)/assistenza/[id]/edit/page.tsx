import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { ServiceTicketForm } from "@/features/service";
import { getServiceTicketById } from "@/features/service/services/service-tickets.service";
import { listProducts } from "@/features/products/services/products.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifica ticket" };

export default async function EditServiceTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Modifica ticket" />
        <EmptyState icon={LifeBuoy} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const ticket = await getServiceTicketById(id);
  if (!ticket) {
    notFound();
  }

  const productsResult = await listProducts({ activeOnly: true });

  return (
    <div className="space-y-6">
      <PageHeader title="Modifica ticket" subtitle={ticket.title} />
      <ServiceTicketForm ticket={ticket} products={productsResult.data ?? []} />
    </div>
  );
}
