import type { PriorityTier } from "@/lib/commercial-priority/types";

export const PRIORITY_TIER_LABELS: Record<PriorityTier, string> = {
  high: "Alta",
  medium: "Media",
  low: "Bassa",
  none: "Nessuna",
};

export const PRIORITY_FILTER_OPTIONS = [
  { value: "high", label: "Priorità alta" },
  { value: "medium", label: "Priorità media" },
  { value: "low", label: "Priorità bassa" },
] as const;

export type PriorityFilterValue = (typeof PRIORITY_FILTER_OPTIONS)[number]["value"];

const PRIORITY_FILTER_SET = new Set<string>(PRIORITY_FILTER_OPTIONS.map((option) => option.value));

export function isPriorityFilter(value: string | undefined): value is PriorityFilterValue {
  return value != null && PRIORITY_FILTER_SET.has(value);
}

export function isPrioritySort(value: string | undefined): boolean {
  return value === "priority";
}
