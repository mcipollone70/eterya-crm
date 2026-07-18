"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  PRODUCT_FAMILY_OPTIONS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import { updateProductAction } from "../actions/product-actions";
import type { ProductListItem } from "../services/products.service";

interface EditProductFormProps {
  product: ProductListItem;
}

export function EditProductForm({ product }: EditProductFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const minRaw = String(formData.get("price_range_min") ?? "");
    const maxRaw = String(formData.get("price_range_max") ?? "");

    startTransition(async () => {
      const result = await updateProductAction(product.id, {
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
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Nome</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={product.name}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Famiglia</span>
          <select
            name="family"
            required
            defaultValue={product.family}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {PRODUCT_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm sm:pt-6">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={product.is_active}
            className="rounded border-slate-300"
          />
          <span className="font-medium text-slate-700">Prodotto attivo</span>
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Descrizione</span>
          <textarea
            name="description"
            rows={2}
            defaultValue={product.description ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Prezzo min (EUR)</span>
          <input
            type="number"
            name="price_range_min"
            min={0}
            defaultValue={product.price_range_min ?? undefined}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Prezzo max (EUR)</span>
          <input
            type="number"
            name="price_range_max"
            min={0}
            defaultValue={product.price_range_max ?? undefined}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Note</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={product.notes ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva prodotto
        </Button>
        <Link href={`/products/${product.id}`}>
          <Button type="button" size="sm" variant="outline" disabled={isPending}>
            Annulla
          </Button>
        </Link>
      </div>
    </form>
  );
}
