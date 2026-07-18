import type { SampleStatus } from "@/lib/supabase/types";

export const SAMPLE_STATUSES = [
  "consegnato",
  "restituito",
  "acquistato",
  "perso",
] as const satisfies readonly SampleStatus[];

export const SAMPLE_STATUS_LABELS: Record<SampleStatus, string> = {
  consegnato: "Consegnato",
  restituito: "Restituito",
  acquistato: "Acquistato",
  perso: "Perso",
};

export const SAMPLE_STATUS_OPTIONS = SAMPLE_STATUSES.map((value) => ({
  value,
  label: SAMPLE_STATUS_LABELS[value],
}));

const STATUS_SET = new Set<string>(SAMPLE_STATUSES);

export function isSampleStatus(value: string | undefined): value is SampleStatus {
  return value != null && STATUS_SET.has(value);
}

export function sampleStatusVariant(
  status: SampleStatus
): "muted" | "info" | "success" | "warning" | "danger" {
  if (status === "acquistato") {
    return "success";
  }
  if (status === "consegnato") {
    return "info";
  }
  if (status === "restituito") {
    return "muted";
  }
  return "danger";
}

export interface SampleFilters {
  companyId?: string;
  productId?: string;
  agentId?: string;
  status?: SampleStatus;
  from?: string;
  to?: string;
}

export function parseSampleFilters(input: {
  company?: string;
  product?: string;
  agent?: string;
  status?: string;
  from?: string;
  to?: string;
}): SampleFilters {
  const filters: SampleFilters = {};

  if (input.company?.trim()) {
    filters.companyId = input.company.trim();
  }
  if (input.product?.trim()) {
    filters.productId = input.product.trim();
  }
  if (input.agent?.trim()) {
    filters.agentId = input.agent.trim();
  }
  if (isSampleStatus(input.status)) {
    filters.status = input.status;
  }
  if (input.from && /^\d{4}-\d{2}-\d{2}$/.test(input.from)) {
    filters.from = input.from;
  }
  if (input.to && /^\d{4}-\d{2}-\d{2}$/.test(input.to)) {
    filters.to = input.to;
  }

  return filters;
}
