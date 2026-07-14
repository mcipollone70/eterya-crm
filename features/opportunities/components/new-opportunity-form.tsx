"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { OPPORTUNITY_STAGE_OPTIONS } from "@/lib/constants/opportunity-pipeline";
import {
  PRODUCT_FAMILY_OPTIONS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import type { ProductListItem } from "@/features/products/services/products.service";
import { saveOpportunityAction } from "../actions/opportunity-actions";
import {
  OpportunityKanbanToast,
  type OpportunityKanbanToastVariant,
} from "./opportunity-kanban-toast";

interface NewOpportunityFormProps {
  companyId: string;
  contacts?: ContactListItem[];
  products?: ProductListItem[];
}

const DEFAULT_PRODUCT_FAMILY: ProductFamily = "zanzariere";

export function NewOpportunityForm({
  companyId,
  contacts = [],
  products = [],
}: NewOpportunityFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: OpportunityKanbanToastVariant } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [selectedFamily, setSelectedFamily] = useState<ProductFamily>(DEFAULT_PRODUCT_FAMILY);

  const familyProducts = useMemo(
    () => products.filter((product) => product.family === selectedFamily && product.is_active),
    [products, selectedFamily]
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const resetFormFields = useCallback(() => {
    formRef.current?.reset();
    setSelectedFamily(DEFAULT_PRODUCT_FAMILY);
    setMessage(null);
    setToast(null);
  }, []);

  function handleCancel() {
    resetFormFields();
    setIsOpen(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
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
      companyId,
      contactId: String(formData.get("contact_id") ?? "") || null,
      title: String(formData.get("title") ?? ""),
      productFamily,
      productIds,
      estimatedValue: valueRaw ? Number(valueRaw) : 0,
      probability: probabilityRaw ? Number(probabilityRaw) : 50,
      stage: "new" as const,
      expectedCloseAt: expectedCloseRaw || null,
      notes: String(formData.get("notes") ?? "") || null,
    };

    startTransition(async () => {
      const result = await saveOpportunityAction(payload);

      if (!result.success) {
        setToast({ message: result.message, variant: "error" });
        return;
      }

      resetFormFields();
      setMessage(result.message);
      setIsOpen(false);
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuova opportunità
      </Button>
    );
  }

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Titolo</span>
            <input
              type="text"
              name="title"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Es. Fornitura zanzariere uffici"
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

          {contacts.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Referente</span>
              <select name="contact_id" className="w-full rounded-lg border border-slate-200 px-3 py-2">
                <option value="">Nessun referente</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Prodotti collegati</span>
            <select
              name="product_ids"
              multiple
              size={Math.min(5, Math.max(3, familyProducts.length))}
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
            <span className="mt-1 block text-xs text-slate-500">
              Tieni premuto Ctrl per selezionare più prodotti.
            </span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Valore stimato (EUR)</span>
            <input
              type="number"
              name="estimated_value"
              min={0}
              step="100"
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
              defaultValue={50}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Chiusura prevista</span>
            <input
              type="date"
              name="expected_close_at"
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Fase iniziale</span>
            <select
              name="stage"
              defaultValue="new"
              disabled
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2"
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
          <textarea name="notes" rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>

        {message && <p className="text-sm text-emerald-700">{message}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salva opportunità
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleCancel}>
            Annulla
          </Button>
        </div>
      </form>

      {toast ? (
        <OpportunityKanbanToast message={toast.message} variant={toast.variant} onDismiss={dismissToast} />
      ) : null}
    </>
  );
}
