"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { CompanySelect } from "@/features/companies/components/company-select";
import { SAMPLE_STATUS_OPTIONS } from "@/lib/constants/samples";
import type { SampleStatus } from "@/lib/supabase/types";
import type { ProductListItem } from "@/features/products/services/products.service";
import { saveSampleAction, updateSampleAction } from "../actions/sample-actions";
import type { SampleListItem } from "../services/samples.service";

interface SampleFormProps {
  products: ProductListItem[];
  sample?: SampleListItem;
  initialCompanyId?: string;
}

export function SampleForm({ products, sample, initialCompanyId }: SampleFormProps) {
  const router = useRouter();
  const isEdit = Boolean(sample);
  const [companyId, setCompanyId] = useState(sample?.company_id ?? initialCompanyId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!companyId) {
      setError("Seleziona l'azienda destinataria del campione.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const quantityRaw = String(formData.get("quantity") ?? "");
    const givenAtRaw = String(formData.get("given_at") ?? "");
    const expectedReturnRaw = String(formData.get("expected_return_at") ?? "");
    const productId = String(formData.get("product_id") ?? "") || null;

    const payload = {
      companyId,
      productId,
      title: String(formData.get("title") ?? ""),
      quantity: quantityRaw ? Number(quantityRaw) : 1,
      status: String(formData.get("status") ?? "consegnato") as SampleStatus,
      givenAt: givenAtRaw ? new Date(givenAtRaw).toISOString() : null,
      expectedReturnAt: expectedReturnRaw || null,
      notes: String(formData.get("notes") ?? "") || null,
    };

    startTransition(async () => {
      if (isEdit && sample) {
        const result = await updateSampleAction(sample.id, payload);
        if (!result.success) {
          setError(result.message);
          return;
        }
        router.push(`/campioni/${sample.id}`);
        router.refresh();
        return;
      }

      const result = await saveSampleAction(payload);
      if (!result.success) {
        setError(result.message);
        return;
      }
      if (result.sampleId) {
        router.push(`/campioni/${result.sampleId}`);
      }
    });
  }

  const givenAtDefault = sample?.given_at
    ? sample.given_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const expectedReturnDefault = sample?.expected_return_at
    ? sample.expected_return_at.slice(0, 10)
    : "";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Azienda</span>
        <CompanySelect
          value={companyId}
          onChange={setCompanyId}
          disabled={isEdit}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Descrizione campione</span>
          <input
            type="text"
            name="title"
            required
            defaultValue={sample?.title ?? ""}
            placeholder="Es. Campione zanzariera plissettata"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Prodotto (catalogo)</span>
          <select
            name="product_id"
            defaultValue={sample?.product_id ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">Nessun prodotto collegato</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Quantità</span>
          <input
            type="number"
            name="quantity"
            min={1}
            defaultValue={sample?.quantity ?? 1}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Stato</span>
          <select
            name="status"
            defaultValue={sample?.status ?? "consegnato"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {SAMPLE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Data consegna</span>
          <input
            type="date"
            name="given_at"
            defaultValue={givenAtDefault}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Rientro previsto</span>
          <input
            type="date"
            name="expected_return_at"
            defaultValue={expectedReturnDefault}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Note</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={sample?.notes ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEdit ? "Salva campione" : "Registra campione"}
        </Button>
        <Link href={isEdit && sample ? `/campioni/${sample.id}` : "/campioni"}>
          <Button type="button" size="sm" variant="outline" disabled={isPending}>
            Annulla
          </Button>
        </Link>
      </div>
    </form>
  );
}
