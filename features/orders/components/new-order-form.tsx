"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { saveOrderAction } from "../actions/order-actions";
import {
  QuoteLinesEditor,
  linesFromFormData,
} from "@/features/quotes/components/quote-lines-editor";

interface NewOrderFormProps {
  companies: Array<{ id: string; name: string }>;
  contacts: ContactListItem[];
  products: ProductListItem[];
  defaultCompanyId?: string;
}

export function NewOrderForm({
  companies,
  contacts,
  products,
  defaultCompanyId,
}: NewOrderFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedFamily, setSelectedFamily] = useState<ProductFamily>("zanzariere");
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");

  const companyContacts = useMemo(
    () => contacts.filter((contact) => contact.company_id === companyId),
    [contacts, companyId]
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const lines = linesFromFormData(formData);
    const acceptedAtRaw = String(formData.get("order_date") ?? "");

    startTransition(async () => {
      const result = await saveOrderAction({
        companyId: String(formData.get("company_id") ?? ""),
        contactId: String(formData.get("contact_id") ?? "") || null,
        title: String(formData.get("title") ?? ""),
        number: String(formData.get("number") ?? "") || null,
        productFamily: String(formData.get("product_family") ?? "") as ProductFamily,
        lines,
        productIds: lines.map((line) => line.productId),
        orderStatus: String(formData.get("order_status") ?? "confermato") as OrderFulfillmentStatus,
        orderDate: acceptedAtRaw || null,
        expectedDeliveryAt: String(formData.get("expected_delivery_at") ?? "") || null,
        acceptedAt: acceptedAtRaw ? new Date(acceptedAtRaw).toISOString() : null,
        notes: String(formData.get("notes") ?? "") || null,
        nextAction: String(formData.get("next_action") ?? "") || null,
      });

      if (!result.success || !result.orderId) {
        setError(result.message);
        return;
      }
      router.push(`/ordini/${result.orderId}`);
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Azienda *</span>
          <select
            name="company_id"
            required
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">Seleziona azienda…</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Titolo *</span>
          <input
            type="text"
            name="title"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Numero (auto se vuoto)</span>
          <input type="text" name="number" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Stato ordine</span>
          <select
            name="order_status"
            defaultValue="confermato"
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
            name="order_date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Consegna prevista</span>
          <input
            type="date"
            name="expected_delivery_at"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Famiglia prodotto</span>
          <select
            name="product_family"
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

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Referente</span>
          <select name="contact_id" className="w-full rounded-lg border border-slate-200 px-3 py-2">
            <option value="">Nessuno</option>
            {companyContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.full_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Prossima azione</span>
          <input type="text" name="next_action" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Note</span>
          <textarea name="notes" rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>
      </div>

      <QuoteLinesEditor products={products} familyFilter={selectedFamily} />

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending || !companyId}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Crea ordine
        </Button>
        <Link href="/ordini">
          <Button type="button" variant="outline">
            Annulla
          </Button>
        </Link>
      </div>
    </form>
  );
}
