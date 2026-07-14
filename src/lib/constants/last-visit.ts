export const LAST_VISIT_FILTER_OPTIONS = [
  { value: "never", label: "Mai visitate" },
  { value: "over_30", label: "Oltre 30 giorni" },
  { value: "over_60", label: "Oltre 60 giorni" },
  { value: "over_90", label: "Oltre 90 giorni" },
] as const;

export type LastVisitFilterValue = (typeof LAST_VISIT_FILTER_OPTIONS)[number]["value"];

const LAST_VISIT_FILTER_SET = new Set<string>(
  LAST_VISIT_FILTER_OPTIONS.map((option) => option.value)
);

export function isLastVisitFilter(value: string | undefined): value is LastVisitFilterValue {
  return value != null && LAST_VISIT_FILTER_SET.has(value);
}

export function isLastVisitSort(value: string | undefined): boolean {
  return value === "last_visit";
}

export const VISIT_OUTCOME_OPTIONS = [
  { value: "positivo", label: "Positivo" },
  { value: "neutro", label: "Neutro" },
  { value: "negativo", label: "Negativo" },
  { value: "non_interessato", label: "Non interessato" },
  { value: "ordine", label: "Ordine" },
  { value: "preventivo", label: "Preventivo richiesto" },
] as const;

export type VisitOutcomeValue = (typeof VISIT_OUTCOME_OPTIONS)[number]["value"];

export const VISIT_OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  VISIT_OUTCOME_OPTIONS.map((option) => [option.value, option.label])
);

export function getVisitOutcomeLabel(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return VISIT_OUTCOME_LABELS[value] ?? value;
}
