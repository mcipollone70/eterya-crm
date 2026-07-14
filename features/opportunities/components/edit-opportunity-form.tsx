"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { OPPORTUNITY_STAGE_OPTIONS } from "@/lib/constants/opportunity-pipeline";
import {
  PRODUCT_FAMILY_OPTIONS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import type { ProductListItem } from "@/features/products/services/products.service";
import { updateOpportunityAction } from "../actions/opportunity-actions";
import type { OpportunityListItem } from "../services/opportunities.service";
import {
  OpportunityKanbanToast,
  type OpportunityKanbanToastVariant,
} from "./opportunity-kanban-toast";

interface EditOpportunityFormProps {
  opportunity: OpportunityListItem;
  contacts: ContactListItem[];
  products: ProductListItem[];
}

export function EditOpportunityForm({
  opportunity,
  contacts,
  products,
}: EditOpportunityFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [toast, setToast] = useState<{ message: string; variant: OpportunityKanbanToastVariant } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [selectedFamily, setSelectedFamily] = useState<ProductFamily>(opportunity.product_family);

  const familyProducts = useMemo(
    () => products.filter((product) => product.family === selectedFamily && product.is_active),
    [products, selectedFamily]
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);

    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const valueRaw = String(formData.get("estimated_value") ?? "");
    const probabilityRaw = String(formData.get("probability") ?? "");
    const expectedCloseRaw = String(formData.get("expected_close_at") ?? "");
    const productFamily = String(formData.get("product_family") ?? "") as ProductFamily;
    const productIds = formData
      .getAll("product_ids")
      .map((value) => String(value))
      .filter(Boolean);

    const payload = {
      companyId: opportunity.company_id,
      contactId: String(formData.get("contact_id") ?? "") || null,
      title: String(formData.get("title") ?? ""),
      productFamily,
      productIds,
      estimatedValue: valueRaw ? Number(valueRaw) : 0,
      probability: probabilityRaw ? Number(probabilityRaw) : 50,
      stage: String(formData.get("stage") ?? opportunity.stage) as OpportunityListItem["stage"],
      expectedCloseAt: expectedCloseRaw || null,
      notes: String(formData.get("notes") ?? "") || null,
    };

    startTransition(async () => {
      const result = await updateOpportunityAction(opportunity.id, payload);

      if (!result.success) {
        setToast({ message: result.message, variant: "error" });
      }
    });
  }

  const expectedCloseDefault = opportunity.expected_close_at
    ? opportunity.expected_close_at.slice(0, 10)
    : "";

  return (
    <>
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
              defaultValue={opportunity.title}
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
                defaultValue={opportunity.contact_id ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="">Nessun referente</option>
                {opportunity.contact_id &&
                  !contacts.some((contact) => contact.id === opportunity.contact_id) && (
                    <option value={opportunity.contact_id}>
                      {opportunity.contact_name ?? "Referente collegato"}
                    </option>
                  )}
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.full_name}
                  </option>
                ))}
              </select>
            </label>
          ) : opportunity.contact_id ? (
            <input type="hidden" name="contact_id" value={opportunity.contact_id} />
          ) : null}

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Prodotti collegati</span>
            <select
              name="product_ids"
              multiple
              size={Math.min(5, Math.max(3, familyProducts.length))}
              defaultValue={opportunity.product_ids}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {familyProducts.length === 0 ? (
                <option disabled>Nessun prodotto attivo per questa famiglia</option>
              ) : (
                familyProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Valore stimato (EUR)</span>
            <input
              type="number"
              name="estimated_value"
              min={0}
              step="100"
              defaultValue={opportunity.total_amount}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Probabilità (%)</span>
            <input
              type="number"
              name="probability"
              min={0}
              max={100}
              defaultValue={opportunity.probability ?? 50}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Chiusura prevista</span>
            <input
              type="date"
              name="expected_close_at"
              defaultValue={expectedCloseDefault}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Fase</span>
            <select
              name="stage"
              defaultValue={opportunity.stage}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {OPPORTUNITY_STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Note</span>
          <textarea
            name="notes"
            rows={4}
            defaultValue={opportunity.notes ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salva modifiche
          </Button>
          <Link href={`/opportunities/${opportunity.id}`}>
            <Button type="button" size="sm" variant="outline" disabled={isPending}>
              Annulla
            </Button>
          </Link>
        </div>
      </form>

      {toast ? (
        <OpportunityKanbanToast message={toast.message} variant={toast.variant} onDismiss={dismissToast} />
      ) : null}
    </>
  );
}
