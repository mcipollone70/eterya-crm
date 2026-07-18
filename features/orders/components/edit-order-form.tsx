"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  PRODUCT_FAMILY_OPTIONS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import { ORDER_FULFILLMENT_STATUS_OPTIONS } from "@/lib/constants/orders";
import type { OrderFulfillmentStatus } from "@/lib/supabase/types";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import type { ProductListItem } from "@/features/products/services/products.service";
import { updateOrderAction } from "../actions/order-actions";
import type { OrderListItem } from "../services/orders.service";
import {
  QuoteLinesEditor,
  linesFromFormData,
  type LineDraft,
} from "@/features/quotes/components/quote-lines-editor";

interface EditOrderFormProps {
  order: OrderListItem;
  contacts: ContactListItem[];
  products: ProductListItem[];
}

export function EditOrderForm({ order, contacts, products }: EditOrderFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedFamily, setSelectedFamily] = useState<ProductFamily>(order.product_family);

  const initialLines: LineDraft[] = useMemo(
    () =>
      order.lines.length > 0
        ? order.lines.map((line, index) => ({
            key: line.id ?? `line-${index}`,
            id: line.id,
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPercent: line.discountPercent ?? 0,
            vatRate: line.vatRate ?? 22,
            description: line.description ?? "",
          }))
        : order.product_ids.map((productId, index) => ({
            key: `line-${index}`,
            productId,
            quantity: 1,
            unitPrice: 0,
            discountPercent: 0,
            vatRate: 22,
            description: "",
          })),
    [order]
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const lines = linesFromFormData(formData);
    const amountRaw = String(formData.get("total_amount") ?? "");
    const acceptedAtRaw = String(formData.get("accepted_at") ?? "");
    const productFamily = String(formData.get("product_family") ?? "") as ProductFamily;

    const payload = {
      companyId: order.company_id,
      contactId: String(formData.get("contact_id") ?? "") || null,
      title: String(formData.get("title") ?? ""),
      number: String(formData.get("number") ?? "") || null,
      productFamily,
      lines,
      productIds: lines.map((line) => line.productId),
      totalAmount: amountRaw ? Number(amountRaw) : undefined,
      acceptedAt: acceptedAtRaw ? new Date(acceptedAtRaw).toISOString() : null,
      orderDate: acceptedAtRaw || order.order_date,
      orderStatus: String(formData.get("order_status") ?? order.order_status ?? "confermato") as OrderFulfillmentStatus,
      expectedDeliveryAt: String(formData.get("expected_delivery_at") ?? "") || null,
      nextAction: String(formData.get("next_action") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    };

    startTransition(async () => {
      const result = await updateOrderAction(order.id, payload);
      if (!result.success) {
        setError(result.message);
      }
    });
  }

  const acceptedAtDefault = order.order_date
    ?? (order.accepted_at ? order.accepted_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const deliveryDefault = order.expected_delivery_at
    ? order.expected_delivery_at.slice(0, 10)
    : "";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Titolo</span>
          <input
            type="text"
            name="title"
            required
            defaultValue={order.title}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Numero ordine</span>
          <input
            type="text"
            name="number"
            defaultValue={order.number ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Stato evasione</span>
          <select
            name="order_status"
            defaultValue={order.order_status ?? "confermato"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {ORDER_FULFILLMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Data ordine</span>
          <input
            type="date"
            name="accepted_at"
            defaultValue={acceptedAtDefault}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Consegna prevista</span>
          <input
            type="date"
            name="expected_delivery_at"
            defaultValue={deliveryDefault}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Famiglia prodotto</span>
          <select
            name="product_family"
            required
            value={selectedFamily}
            onChange={(event) => setSelectedFamily(event.target.value as ProductFamily)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {PRODUCT_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {contacts.length > 0 ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Referente</span>
            <select
              name="contact_id"
              defaultValue={order.contact_id ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">Nessun referente</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.full_name}
                </option>
              ))}
            </select>
          </label>
        ) : order.contact_id ? (
          <input type="hidden" name="contact_id" value={order.contact_id} />
        ) : null}

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Prossima azione</span>
          <input
            type="text"
            name="next_action"
            defaultValue={order.next_action ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <QuoteLinesEditor
        products={products}
        familyFilter={selectedFamily}
        initialLines={initialLines}
      />

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Note</span>
        <textarea
          name="notes"
          rows={4}
          defaultValue={order.notes ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva ordine
        </Button>
        <Link href={`/ordini/${order.id}`}>
          <Button type="button" size="sm" variant="outline" disabled={isPending}>
            Annulla
          </Button>
        </Link>
      </div>
    </form>
  );
}
