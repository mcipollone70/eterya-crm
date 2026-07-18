import type { OrderFulfillmentStatus } from "@/lib/supabase/types";

export interface OrderFilters {
  companyId?: string;
  agentId?: string;
  from?: string;
  to?: string;
  status?: OrderFulfillmentStatus;
}

export function parseOrderFilters(input: {
  company?: string;
  agent?: string;
  from?: string;
  to?: string;
  status?: string;
}): OrderFilters {
  const filters: OrderFilters = {};

  if (input.company?.trim()) {
    filters.companyId = input.company.trim();
  }
  if (input.agent?.trim()) {
    filters.agentId = input.agent.trim();
  }
  if (input.from && /^\d{4}-\d{2}-\d{2}$/.test(input.from)) {
    filters.from = input.from;
  }
  if (input.to && /^\d{4}-\d{2}-\d{2}$/.test(input.to)) {
    filters.to = input.to;
  }
  if (input.status && isOrderFulfillmentStatus(input.status)) {
    filters.status = input.status;
  }

  return filters;
}

export const ORDER_FULFILLMENT_STATUSES = [
  "bozza",
  "confermato",
  "in_lavorazione",
  "pronto",
  "consegnato",
  "annullato",
] as const satisfies readonly OrderFulfillmentStatus[];

export type OrderFulfillmentStatusValue = (typeof ORDER_FULFILLMENT_STATUSES)[number];

export const ORDER_FULFILLMENT_STATUS_LABELS: Record<OrderFulfillmentStatus, string> = {
  bozza: "Bozza",
  confermato: "Confermato",
  in_lavorazione: "In lavorazione",
  pronto: "Pronto",
  consegnato: "Consegnato",
  annullato: "Annullato",
};

export const ORDER_FULFILLMENT_STATUS_OPTIONS = ORDER_FULFILLMENT_STATUSES.map((value) => ({
  value,
  label: ORDER_FULFILLMENT_STATUS_LABELS[value],
}));

const ORDER_STATUS_SET = new Set<string>(ORDER_FULFILLMENT_STATUSES);

export function isOrderFulfillmentStatus(
  value: string | undefined
): value is OrderFulfillmentStatus {
  return value != null && ORDER_STATUS_SET.has(value);
}

export function orderStatusVariant(
  status: OrderFulfillmentStatus | null | undefined
): "muted" | "info" | "success" | "warning" | "danger" {
  if (status === "consegnato") return "success";
  if (status === "confermato" || status === "pronto") return "info";
  if (status === "in_lavorazione") return "warning";
  if (status === "annullato") return "danger";
  return "muted";
}

export const ORDER_SOURCE_LABELS = {
  pipeline: "Pipeline commerciale",
  manual: "Registrazione manuale",
  preventivo: "Da preventivo",
} as const;
