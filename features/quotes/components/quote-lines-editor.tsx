"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { ProductListItem } from "@/features/products/services/products.service";
import {
  calcLineTotal,
  type CommercialLineInput,
} from "@/lib/constants/commercial-lines";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";

export interface LineDraft {
  key: string;
  id?: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  description: string;
}

interface QuoteLinesEditorProps {
  products: ProductListItem[];
  familyFilter?: string;
  initialLines?: LineDraft[];
  onChange?: (lines: CommercialLineInput[]) => void;
  namePrefix?: string;
}

function toInput(lines: LineDraft[]): CommercialLineInput[] {
  return lines
    .filter((line) => line.productId)
    .map((line, index) => ({
      id: line.id,
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      vatRate: line.vatRate,
      description: line.description || null,
      sortOrder: index,
    }));
}

export function QuoteLinesEditor({
  products,
  familyFilter,
  initialLines,
  onChange,
  namePrefix = "line",
}: QuoteLinesEditorProps) {
  const [lines, setLines] = useState<LineDraft[]>(
    initialLines && initialLines.length > 0
      ? initialLines
      : [
          {
            key: "line-0",
            productId: "",
            quantity: 1,
            unitPrice: 0,
            discountPercent: 0,
            vatRate: 22,
            description: "",
          },
        ]
  );

  const availableProducts = useMemo(() => {
    const active = products.filter((product) => product.is_active);
    if (!familyFilter) return active;
    return active.filter((product) => product.family === familyFilter);
  }, [products, familyFilter]);

  function updateLines(next: LineDraft[]) {
    setLines(next);
    onChange?.(toInput(next));
  }

  function addLine() {
    updateLines([
      ...lines,
      {
        key: `line-${Date.now()}`,
        productId: "",
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        vatRate: 22,
        description: "",
      },
    ]);
  }

  function removeLine(key: string) {
    const next = lines.filter((line) => line.key !== key);
    updateLines(
      next.length > 0
        ? next
        : [
            {
              key: "line-0",
              productId: "",
              quantity: 1,
              unitPrice: 0,
              discountPercent: 0,
              vatRate: 22,
              description: "",
            },
          ]
    );
  }

  function patchLine(key: string, patch: Partial<LineDraft>) {
    updateLines(
      lines.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (patch.productId) {
          const product = products.find((item) => item.id === patch.productId);
          if (product && patch.unitPrice == null) {
            next.unitPrice = product.price_range_min ?? product.price_range_max ?? 0;
          }
        }
        return next;
      })
    );
  }

  const total = lines.reduce(
    (sum, line) =>
      sum +
      (line.productId
        ? calcLineTotal({
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPercent: line.discountPercent,
            vatRate: line.vatRate,
          })
        : 0),
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Righe prodotto</h3>
        <Button type="button" size="sm" variant="outline" onClick={addLine}>
          <Plus className="h-4 w-4" />
          Aggiungi riga
        </Button>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => {
          const lineTotal = line.productId
            ? calcLineTotal({
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discountPercent: line.discountPercent,
                vatRate: line.vatRate,
              })
            : 0;

          return (
            <div
              key={line.key}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Riga {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  className="rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600"
                  aria-label="Rimuovi riga"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {line.id ? (
                <input type="hidden" name={`${namePrefix}_id`} value={line.id} />
              ) : (
                <input type="hidden" name={`${namePrefix}_id`} value="" />
              )}
              <input type="hidden" name={`${namePrefix}_product_id`} value={line.productId} />
              <input type="hidden" name={`${namePrefix}_quantity`} value={line.quantity} />
              <input type="hidden" name={`${namePrefix}_unit_price`} value={line.unitPrice} />
              <input
                type="hidden"
                name={`${namePrefix}_discount_percent`}
                value={line.discountPercent}
              />
              <input type="hidden" name={`${namePrefix}_vat_rate`} value={line.vatRate} />
              <input
                type="hidden"
                name={`${namePrefix}_description`}
                value={line.description}
              />

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <label className="block text-sm lg:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Prodotto</span>
                  <select
                    value={line.productId}
                    onChange={(event) =>
                      patchLine(line.key, { productId: event.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                  >
                    <option value="">Seleziona…</option>
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Qtà</span>
                  <input
                    type="number"
                    min={0.001}
                    step="any"
                    value={line.quantity}
                    onChange={(event) =>
                      patchLine(line.key, { quantity: Number(event.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Prezzo</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) =>
                      patchLine(line.key, { unitPrice: Number(event.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Sconto %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={line.discountPercent}
                    onChange={(event) =>
                      patchLine(line.key, {
                        discountPercent: Number(event.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-600">IVA %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={line.vatRate}
                    onChange={(event) =>
                      patchLine(line.key, { vatRate: Number(event.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="mt-2 block text-sm lg:col-span-6">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Descrizione
                </span>
                <input
                  type="text"
                  value={line.description}
                  onChange={(event) =>
                    patchLine(line.key, { description: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                />
              </label>
              <p className="mt-2 text-right text-xs font-medium text-slate-700">
                Totale riga: {formatOpportunityAmount(lineTotal)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900">
        Totale documento: {formatOpportunityAmount(total)}
      </div>
    </div>
  );
}

export function linesFromFormData(
  formData: FormData,
  prefix = "line"
): CommercialLineInput[] {
  const ids = formData.getAll(`${prefix}_id`).map(String);
  const productIds = formData.getAll(`${prefix}_product_id`).map(String);
  const quantities = formData.getAll(`${prefix}_quantity`).map(String);
  const unitPrices = formData.getAll(`${prefix}_unit_price`).map(String);
  const discounts = formData.getAll(`${prefix}_discount_percent`).map(String);
  const vatRates = formData.getAll(`${prefix}_vat_rate`).map(String);
  const descriptions = formData.getAll(`${prefix}_description`).map(String);

  return productIds
    .map((productId, index) => ({
      id: ids[index]?.trim() || undefined,
      productId,
      quantity: Number(quantities[index] ?? 1) || 1,
      unitPrice: Number(unitPrices[index] ?? 0) || 0,
      discountPercent: Number(discounts[index] ?? 0) || 0,
      vatRate: Number(vatRates[index] ?? 22) || 22,
      description: descriptions[index]?.trim() || null,
      sortOrder: index,
    }))
    .filter((line) => line.productId);
}
