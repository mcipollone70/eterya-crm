import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { ServiceTicketDetail } from "@/features/service";
import { getServiceTicketById } from "@/features/service/services/service-tickets.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dettaglio ticket" };

export default async function ServiceTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dettaglio ticket" />
        <EmptyState icon={LifeBuoy} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const ticket = await getServiceTicketById(id);
  if (!ticket) {
    notFound();
  }

  return <ServiceTicketDetail ticket={ticket} />;
}
