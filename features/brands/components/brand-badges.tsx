"use client";

import { resolveBrandInitial, sortBrandAssociations, type BrandAssociationView } from "../utils/brand-shared";
import { BRAND_RELATIONSHIP_STATUS_LABELS } from "@/lib/constants/brand-relationship";

interface BrandBadgesProps {
  brands: BrandAssociationView[];
  /** Mostra stato relazione sotto/accanto al nome. */
  showStatus?: boolean;
  compact?: boolean;
  className?: string;
}

export function BrandBadges({
  brands,
  showStatus = false,
  compact = false,
  className,
}: BrandBadgesProps) {
  const ordered = sortBrandAssociations(brands);
  if (ordered.length === 0) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <div className={className ?? "flex flex-wrap gap-1"}>
      {ordered.map((brand) => {
        const initial = resolveBrandInitial(brand);
        const bg = brand.color?.trim() || "#64748b";
        return (
          <span
            key={brand.brand_id}
            title={`${brand.name}${brand.is_primary ? " (principale)" : ""}${
              showStatus
                ? ` · ${BRAND_RELATIONSHIP_STATUS_LABELS[brand.relationship_status]}`
                : ""
            }`}
            className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white ${
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
            } font-medium text-slate-700`}
          >
            <span
              className={`inline-flex items-center justify-center rounded-full font-bold text-white ${
                compact ? "h-4 w-4 text-[9px]" : "h-5 w-5 text-[10px]"
              }`}
              style={{ backgroundColor: bg }}
            >
              {initial}
            </span>
            <span className="truncate max-w-[7rem]">{brand.name}</span>
            {brand.is_primary && (
              <span className="rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800">
                ★
              </span>
            )}
            {showStatus && !compact && (
              <span className="text-[10px] font-normal text-slate-500">
                {BRAND_RELATIONSHIP_STATUS_LABELS[brand.relationship_status]}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
