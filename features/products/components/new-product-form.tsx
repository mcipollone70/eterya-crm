"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import {
  PRODUCT_FAMILY_OPTIONS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import { saveProductAction } from "../actions/product-actions";

export function NewProductForm() {
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
    const minRaw = String(formData.get("price_range_min") ?? "");
    const maxRaw = String(formData.get("price_range_max") ?? "");

    startTransition(async () => {
      const result = await saveProductAction({
        name: String(formData.get("name") ?? ""),
        family: String(formData.get("family") ?? "") as ProductFamily,
        description: String(formData.get("description") ?? "") || null,
        isActive: formData.get("is_active") === "on",
        priceRangeMin: minRaw ? Number(minRaw) : null,
        priceRangeMax: maxRaw ? Number(maxRaw) : null,
        notes: String(formData.get("notes") ?? "") || null,
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
        Nuovo prodotto
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Nome</span>
          <input type="text" name="name" required className="w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Famiglia</span>
          <select name="family" required className="w-full rounded-lg border border-slate-200 px-3 py-2">
            {PRODUCT_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm sm:pt-6">
          <input type="checkbox" name="is_active" defaultChecked className="rounded border-slate-300" />
          <span className="font-medium text-slate-700">Prodotto attivo</span>
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Descrizione</span>
          <textarea name="description" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Prezzo min (EUR)</span>
          <input type="number" name="price_range_min" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Prezzo max (EUR)</span>
          <input type="number" name="price_range_max" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Note</span>
        <textarea name="notes" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
      </label>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva prodotto
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setIsOpen(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
