"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Star, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { BRAND_RELATIONSHIP_STATUS_OPTIONS } from "@/lib/constants/brand-relationship";
import type { BrandRelationshipStatus } from "@/lib/supabase/types";
import {
  addCompanyBrandAction,
  removeCompanyBrandAction,
  setPrimaryCompanyBrandAction,
  updateCompanyBrandAction,
} from "../actions/company-brand-actions";
import type { CompanyBrandItem } from "../services/company-brands.service";
import type { Brand } from "../services/brands.service";
import { resolveBrandInitial } from "../utils/brand-shared";

interface CompanyBrandsPanelProps {
  companyId: string;
  initialBrands: CompanyBrandItem[];
  catalog: Brand[];
  /** Se false, solo lettura. */
  editable?: boolean;
  /** Schema live: nasconde customer_code / status edit se assenti. */
  schema?: {
    hasRelationshipStatus: boolean;
    hasCustomerCode: boolean;
  };
}

export function CompanyBrandsPanel({
  companyId,
  initialBrands,
  catalog,
  editable = true,
  schema = { hasRelationshipStatus: true, hasCustomerCode: true },
}: CompanyBrandsPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialBrands);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addBrandId, setAddBrandId] = useState("");
  const [addStatus, setAddStatus] = useState<BrandRelationshipStatus>("prospect");

  const linkedIds = useMemo(() => new Set(items.map((i) => i.brand_id)), [items]);
  const available = catalog.filter((b) => b.is_active && !linkedIds.has(b.id));

  function refreshFromServer(next: CompanyBrandItem[]) {
    setItems(next);
    router.refresh();
  }

  async function reloadList(): Promise<CompanyBrandItem[]> {
    // Optimistic: caller passa già i dati aggiornati; refresh server per coerenza
    router.refresh();
    return items;
  }

  function handleAdd() {
    if (!addBrandId) return;
    setError(null);
    startTransition(async () => {
      const result = await addCompanyBrandAction({
        companyId,
        brandId: addBrandId,
        relationshipStatus: schema.hasRelationshipStatus ? addStatus : undefined,
        isPrimary: items.length === 0,
      });
      if (result.error || !result.data) {
        setError(result.error ?? "Impossibile aggiungere il brand.");
        return;
      }
      const next = [...items.filter((i) => i.brand_id !== result.data!.brand_id), result.data];
      if (result.data.is_primary) {
        for (const row of next) {
          if (row.brand_id !== result.data.brand_id) row.is_primary = false;
        }
      }
      setAddBrandId("");
      refreshFromServer(next);
      await reloadList();
    });
  }

  function handleStatusChange(brandId: string, status: BrandRelationshipStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateCompanyBrandAction({
        companyId,
        brandId,
        relationshipStatus: status,
      });
      if (result.error || !result.data) {
        setError(result.error ?? "Impossibile aggiornare lo stato.");
        return;
      }
      refreshFromServer(
        items.map((i) => (i.brand_id === brandId ? result.data! : i))
      );
    });
  }

  function handleSetPrimary(brandId: string) {
    setError(null);
    startTransition(async () => {
      const result = await setPrimaryCompanyBrandAction(companyId, brandId);
      if (result.error || !result.data) {
        setError(result.error ?? "Impossibile impostare il brand principale.");
        return;
      }
      refreshFromServer(
        items.map((i) => ({
          ...i,
          is_primary: i.brand_id === brandId,
        }))
      );
    });
  }

  function handleRemove(brandId: string, brandName: string) {
    if (!window.confirm(`Rimuovere il brand "${brandName}" da questa azienda?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await removeCompanyBrandAction(companyId, brandId);
      if (result.error) {
        setError(result.error);
        return;
      }
      refreshFromServer(items.filter((i) => i.brand_id !== brandId));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand e relazione commerciale</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {!schema.hasRelationshipStatus && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Sul database live la colonna <code>relationship_status</code> non è
            presente: lo stato per brand deriva da <code>companies.commercial_status</code>
            (fallback schema-aware).
          </p>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun brand associato.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const initial = resolveBrandInitial({
                slug: item.brand_slug,
                name: item.brand_name,
              });
              return (
                <li
                  key={item.brand_id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: item.brand_color ?? "#64748b" }}
                    >
                      {initial}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {item.brand_name}
                        {item.is_primary && (
                          <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            <Star className="h-3 w-3" />
                            Principale
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[10px] uppercase text-slate-400">
                        {item.brand_slug}
                      </p>
                      {schema.hasCustomerCode && item.customer_code && (
                        <p className="text-xs text-slate-500">
                          Codice: {item.customer_code}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {schema.hasRelationshipStatus && editable ? (
                      <select
                        value={item.relationship_status}
                        disabled={pending}
                        onChange={(e) =>
                          handleStatusChange(
                            item.brand_id,
                            e.target.value as BrandRelationshipStatus
                          )
                        }
                        aria-label={`Stato relazione ${item.brand_name}`}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                      >
                        {BRAND_RELATIONSHIP_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-slate-600">
                        {
                          BRAND_RELATIONSHIP_STATUS_OPTIONS.find(
                            (o) => o.value === item.relationship_status
                          )?.label
                        }
                      </span>
                    )}

                    {editable && !item.is_primary && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleSetPrimary(item.brand_id)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-60"
                      >
                        <Star className="h-3.5 w-3.5" />
                        Principale
                      </button>
                    )}

                    {editable && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleRemove(item.brand_id, item.brand_name)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Rimuovi
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {editable && available.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-700">Aggiungi brand</span>
              <select
                value={addBrandId}
                onChange={(e) => setAddBrandId(e.target.value)}
                disabled={pending}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Seleziona…</option>
                {available.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.slug})
                  </option>
                ))}
              </select>
            </label>

            {schema.hasRelationshipStatus && (
              <label className="block text-sm sm:w-40">
                <span className="mb-1 block font-medium text-slate-700">Relazione</span>
                <select
                  value={addStatus}
                  onChange={(e) =>
                    setAddStatus(e.target.value as BrandRelationshipStatus)
                  }
                  disabled={pending}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {BRAND_RELATIONSHIP_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="button"
              disabled={pending || !addBrandId}
              onClick={handleAdd}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Aggiungi
            </button>
          </div>
        )}

        {error && <p className="text-sm text-rose-700">{error}</p>}
      </CardContent>
    </Card>
  );
}
