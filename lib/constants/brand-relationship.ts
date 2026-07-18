import type { BrandRelationshipStatus } from "@/lib/supabase/types";

/** Etichette UI per la relazione commerciale per marchio. */
export const BRAND_RELATIONSHIP_STATUS_LABELS: Record<BrandRelationshipStatus, string> = {
  prospect: "Prospect",
  customer: "Cliente",
  former_customer: "Ex cliente",
};

export const BRAND_RELATIONSHIP_STATUS_OPTIONS = (
  Object.keys(BRAND_RELATIONSHIP_STATUS_LABELS) as BrandRelationshipStatus[]
).map((value) => ({
  value,
  label: BRAND_RELATIONSHIP_STATUS_LABELS[value],
}));

const BRAND_RELATIONSHIP_STATUS_SET = new Set<string>(
  Object.keys(BRAND_RELATIONSHIP_STATUS_LABELS)
);

export function isBrandRelationshipStatus(
  value: string | null | undefined
): value is BrandRelationshipStatus {
  return value != null && BRAND_RELATIONSHIP_STATUS_SET.has(value);
}
