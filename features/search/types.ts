import type { BadgeVariant } from "@/components/ui/badge";

export type GlobalSearchCategory =
  | "company"
  | "contact"
  | "opportunity"
  | "visit"
  | "follow_up"
  | "reminder"
  | "product";

export interface GlobalSearchResult {
  id: string;
  category: GlobalSearchCategory;
  title: string;
  subtitle: string | null;
  statusLabel: string;
  statusVariant: BadgeVariant;
  href: string;
  quickActionLabel: string;
}

export interface GlobalSearchGroup {
  category: GlobalSearchCategory;
  label: string;
  results: GlobalSearchResult[];
}

export interface GlobalSearchResponse {
  groups: GlobalSearchGroup[];
  total: number;
  error: string | null;
}

export const GLOBAL_SEARCH_CATEGORY_ORDER: GlobalSearchCategory[] = [
  "company",
  "contact",
  "opportunity",
  "visit",
  "follow_up",
  "reminder",
  "product",
];

export const GLOBAL_SEARCH_CATEGORY_LABELS: Record<GlobalSearchCategory, string> = {
  company: "Aziende",
  contact: "Contatti",
  opportunity: "Opportunità",
  visit: "Visite",
  follow_up: "Follow-up",
  reminder: "Promemoria",
  product: "Prodotti",
};
