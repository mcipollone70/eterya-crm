import { notFound } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { listContactsByCompany } from "@/features/contacts/services/contacts.service";
import { EditOrderForm } from "@/features/orders/components/edit-order-form";
import { getOrderById } from "@/features/orders/services/orders.service";
import { listProducts } from "@/features/products/services/products.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifica ordine" };

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Modifica ordine" />
        <EmptyState icon={ShoppingCart} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const order = await getOrderById(id);
  if (!order) {
    notFound();
  }

  const [contactsResult, productsResult] = await Promise.all([
    listContactsByCompany(order.company_id),
    listProducts({ activeOnly: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Modifica ordine" subtitle={order.title} />
      <EditOrderForm
        order={order}
        contacts={contactsResult.data ?? []}
        products={productsResult.data ?? []}
      />
    </div>
  );
}
