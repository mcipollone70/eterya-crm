"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  PRODUCT_FAMILY_OPTIONS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import { QUOTE_STATUS_OPTIONS } from "@/lib/constants/quotes";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import type { ProductListItem } from "@/features/products/services/products.service";
import { updateQuoteAction } from "../actions/quote-actions";
import type { QuoteListItem } from "../services/quotes.service";
import {
  QuoteLinesEditor,
  linesFromFormData,
  type LineDraft,
} from "./quote-lines-editor";

interface EditQuoteFormProps {
  quote: QuoteListItem;
  contacts: ContactListItem[];
  products: ProductListItem[];
}

export function EditQuoteForm({ quote, contacts, products }: EditQuoteFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedFamily, setSelectedFamily] = useState<ProductFamily>(quote.product_family);

  const initialLines: LineDraft[] = useMemo(
    () =>
      quote.lines.length > 0
        ? quote.lines.map((line, index) => ({
            key: line.id ?? `line-${index}`,
            id: line.id,
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPercent: line.discountPercent ?? 0,
            vatRate: line.vatRate ?? 22,
            description: line.description ?? "",
          }))
        : quote.product_ids.map((productId, index) => ({
            key: `line-${index}`,
            productId,
            quantity: 1,
            unitPrice: 0,
            discountPercent: 0,
            vatRate: 22,
            description: "",
          })),
    [quote]
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const lines = linesFromFormData(formData);
    const amountRaw = String(formData.get("total_amount") ?? "");
    const validUntilRaw = String(formData.get("valid_until") ?? "");
    const productFamily = String(formData.get("product_family") ?? "") as ProductFamily;

    const payload = {
      companyId: quote.company_id,
      contactId: String(formData.get("contact_id") ?? "") || null,
      title: String(formData.get("title") ?? ""),
      number: String(formData.get("number") ?? "") || null,
      productFamily,
      lines,
      productIds: lines.map((line) => line.productId),
      totalAmount: amountRaw ? Number(amountRaw) : undefined,
      validUntil: validUntilRaw || null,
      notes: String(formData.get("notes") ?? "") || null,
      nextAction: String(formData.get("next_action") ?? "") || null,
      status: String(formData.get("status") ?? quote.status) as QuoteListItem["status"],
    };

    startTransition(async () => {
      const result = await updateQuoteAction(quote.id, payload);
      if (!result.success) {
        setError(result.message);
      }
    });
  }

  const validUntilDefault = quote.valid_until ? quote.valid_until.slice(0, 10) : "";

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
            defaultValue={quote.title}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Numero preventivo</span>
          <input
            type="text"
            name="number"
            defaultValue={quote.number ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Stato</span>
          <select
            name="status"
            defaultValue={quote.status}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            aria-describedby="quote-status-hint"
          >
            {QUOTE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span id="quote-status-hint" className="mt-1 block text-xs text-slate-500">
            «Inviato» e «Accettato» aggiornano anche la pipeline; Accettato converte in ordine.
          </span>
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
              defaultValue={quote.contact_id ?? ""}
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
        ) : quote.contact_id ? (
          <input type="hidden" name="contact_id" value={quote.contact_id} />
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Validità</span>
          <input
            type="date"
            name="valid_until"
            defaultValue={validUntilDefault}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Prossima azione</span>
          <input
            type="text"
            name="next_action"
            defaultValue={quote.next_action ?? ""}
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
          defaultValue={quote.notes ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva preventivo
        </Button>
        <Link href={`/preventivi/${quote.id}`}>
          <Button type="button" size="sm" variant="outline" disabled={isPending}>
            Annulla
          </Button>
        </Link>
      </div>
    </form>
  );
}
