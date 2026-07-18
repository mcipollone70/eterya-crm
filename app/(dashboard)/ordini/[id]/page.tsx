import { notFound } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { getOrderById } from "@/features/orders/services/orders.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dettaglio ordine" };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dettaglio ordine" />
        <EmptyState icon={ShoppingCart} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const order = await getOrderById(id);
  if (!order) {
    notFound();
  }

  return <OrderDetail order={order} />;
}
