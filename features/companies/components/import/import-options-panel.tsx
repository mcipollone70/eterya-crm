"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listActiveBrandsForImportAction } from "../../actions/import-companies";
import type { CompanyImportBrandOptions } from "../../types/import";
import { IMPORT_RELATIONSHIP_UI_OPTIONS } from "../../types/import";
import type { BrandRelationshipStatus } from "@/lib/supabase/types";

export interface BrandOption {
  id: string;
  name: string;
  slug: string;
  short_code: string | null;
}

interface ImportOptionsPanelProps {
  value: CompanyImportBrandOptions;
  onChange: (next: CompanyImportBrandOptions) => void;
  disabled?: boolean;
}

const DEFAULT_OPTIONS: CompanyImportBrandOptions = {
  brandId: "",
  brandName: "",
  relationshipStatus: "customer",
  setPrimaryIfNone: true,
  overwriteExistingFields: false,
};

export function getDefaultImportBrandOptions(): CompanyImportBrandOptions {
  return { ...DEFAULT_OPTIONS };
}

export function ImportOptionsPanel({
  value,
  onChange,
  disabled = false,
}: ImportOptionsPanelProps) {
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await listActiveBrandsForImportAction();
      if (cancelled) return;
      if (result.error) {
        setLoadError(result.error);
        setBrands([]);
      } else {
        setLoadError(null);
        setBrands(result.data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectBrand = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    onChange({
      ...value,
      brandId,
      brandName: brand?.name ?? "",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opzioni import</CardTitle>
        <p className="text-xs text-slate-500">
          Scegli tipo relazione e Brand prima di caricare il file Excel. Serve per
          import sequenziali (es. PALAGINA → ZANZAR → ETERYA) senza duplicare
          aziende.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">
              Tipo relazione <span className="text-red-500">*</span>
            </span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              value={value.relationshipStatus}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...value,
                  relationshipStatus: event.target.value as BrandRelationshipStatus,
                })
              }
            >
              {IMPORT_RELATIONSHIP_UI_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">
              Brand <span className="text-red-500">*</span>
            </span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              value={value.brandId}
              disabled={disabled || loading}
              onChange={(event) => selectBrand(event.target.value)}
            >
              <option value="">
                {loading ? "Caricamento brand…" : "Seleziona brand…"}
              </option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                  {brand.short_code ? ` (${brand.short_code})` : ""}
                </option>
              ))}
            </select>
            {loadError && (
              <p className="text-xs text-red-600">{loadError}</p>
            )}
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={value.setPrimaryIfNone}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...value, setPrimaryIfNone: event.target.checked })
            }
          />
          <span>
            Imposta come marchio principale se l&apos;azienda non ne ha già uno
            <span className="mt-0.5 block text-xs text-slate-500">
              Attivo di default. Un secondo Brand non sovrascrive il principale
              esistente.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={value.overwriteExistingFields}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...value,
                overwriteExistingFields: event.target.checked,
              })
            }
          />
          <span>
            Sovrascrivi campi azienda già valorizzati
            <span className="mt-0.5 block text-xs text-slate-500">
              Di default aggiorna solo i campi vuoti.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
