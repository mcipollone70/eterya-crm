import { notFound } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { OrderPrintView } from "@/features/orders/components/order-print-view";
import { getOrderById } from "@/features/orders/services/orders.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Stampa ordine" };

export default async function OrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Stampa ordine" />
        <EmptyState
          icon={ShoppingCart}
          title="Database non configurato"
          message="Configura Supabase."
        />
      </div>
    );
  }

  const order = await getOrderById(id);
  if (!order) {
    notFound();
  }

  return <OrderPrintView order={order} />;
}
