export const PRODUCT_FAMILIES = [
  "zanzariere",
  "tapparelle",
  "vepa",
  "tende_cristal",
  "tende_tecniche_rullo",
] as const;

export type ProductFamily = (typeof PRODUCT_FAMILIES)[number];

export const PRODUCT_FAMILY_LABELS: Record<ProductFamily, string> = {
  zanzariere: "Zanzariere",
  tapparelle: "Tapparelle",
  vepa: "VEPA",
  tende_cristal: "Tende Cristal",
  tende_tecniche_rullo: "Tende tecniche a rullo",
};

export const PRODUCT_FAMILY_OPTIONS = PRODUCT_FAMILIES.map((value) => ({
  value,
  label: PRODUCT_FAMILY_LABELS[value],
}));

export const INTEREST_LEVELS = ["low", "medium", "high"] as const;
export type InterestLevel = (typeof INTEREST_LEVELS)[number];

export const INTEREST_LEVEL_LABELS: Record<InterestLevel, string> = {
  low: "Basso",
  medium: "Medio",
  high: "Alto",
};

export const INTEREST_LEVEL_OPTIONS = INTEREST_LEVELS.map((value) => ({
  value,
  label: INTEREST_LEVEL_LABELS[value],
}));

export type CompanyProductRelation = "interest" | "purchased";

export const COMPANY_PRODUCT_RELATION_LABELS: Record<CompanyProductRelation, string> = {
  interest: "Interesse",
  purchased: "Acquistato",
};

const FAMILY_SET = new Set<string>(PRODUCT_FAMILIES);
const LEVEL_SET = new Set<string>(INTEREST_LEVELS);

export function isProductFamily(value: string | undefined): value is ProductFamily {
  return value != null && FAMILY_SET.has(value);
}

export function isInterestLevel(value: string | undefined): value is InterestLevel {
  return value != null && LEVEL_SET.has(value);
}

export function formatPriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency = "EUR"
): string {
  const formatter = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  if (min != null && max != null) {
    return `${formatter.format(min)} – ${formatter.format(max)}`;
  }
  if (min != null) {
    return `da ${formatter.format(min)}`;
  }
  if (max != null) {
    return `fino a ${formatter.format(max)}`;
  }
  return "—";
}
