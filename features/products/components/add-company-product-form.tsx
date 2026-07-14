"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import {
  INTEREST_LEVEL_OPTIONS,
  type InterestLevel,
} from "@/lib/constants/product-catalog";
import type { ProductListItem } from "../services/products.service";
import { addCompanyProductAction } from "../actions/product-actions";

interface AddCompanyProductFormProps {
  companyId: string;
  products: ProductListItem[];
}

export function AddCompanyProductForm({ companyId, products }: AddCompanyProductFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const relationType = String(formData.get("relation_type") ?? "interest") as "interest" | "purchased";

    startTransition(async () => {
      const result = await addCompanyProductAction({
        companyId,
        productId: String(formData.get("product_id") ?? ""),
        relationType,
        interestLevel:
          relationType === "interest"
            ? (String(formData.get("interest_level") ?? "medium") as InterestLevel)
            : null,
        commercialNotes: String(formData.get("commercial_notes") ?? "") || null,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      setIsOpen(false);
      event.currentTarget.reset();
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4" />
        Aggiungi prodotto
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Prodotto</span>
          <select name="product_id" required className="w-full rounded-lg border border-slate-200 px-3 py-2">
            <option value="">Seleziona prodotto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Tipo</span>
          <select name="relation_type" defaultValue="interest" className="w-full rounded-lg border border-slate-200 px-3 py-2">
            <option value="interest">Prodotto di interesse</option>
            <option value="purchased">Prodotto acquistato</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Livello interesse</span>
          <select name="interest_level" defaultValue="medium" className="w-full rounded-lg border border-slate-200 px-3 py-2">
            {INTEREST_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Note commerciali</span>
        <textarea name="commercial_notes" rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
      </label>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setIsOpen(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
