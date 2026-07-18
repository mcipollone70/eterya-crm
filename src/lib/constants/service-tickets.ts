import type { ActivityPriority, ServiceTicketStatus } from "@/lib/supabase/types";

export const SERVICE_TICKET_STATUSES = [
  "aperto",
  "in_lavorazione",
  "in_attesa",
  "risolto",
  "chiuso",
] as const satisfies readonly ServiceTicketStatus[];

export const SERVICE_TICKET_STATUS_LABELS: Record<ServiceTicketStatus, string> = {
  aperto: "Aperto",
  in_lavorazione: "In lavorazione",
  in_attesa: "In attesa",
  risolto: "Risolto",
  chiuso: "Chiuso",
};

export const SERVICE_TICKET_STATUS_OPTIONS = SERVICE_TICKET_STATUSES.map((value) => ({
  value,
  label: SERVICE_TICKET_STATUS_LABELS[value],
}));

const STATUS_SET = new Set<string>(SERVICE_TICKET_STATUSES);

export function isServiceTicketStatus(value: string | undefined): value is ServiceTicketStatus {
  return value != null && STATUS_SET.has(value);
}

export function serviceTicketStatusVariant(
  status: ServiceTicketStatus
): "muted" | "info" | "success" | "warning" | "danger" {
  if (status === "risolto" || status === "chiuso") {
    return "success";
  }
  if (status === "aperto") {
    return "info";
  }
  if (status === "in_lavorazione") {
    return "warning";
  }
  return "muted";
}

export const SERVICE_TICKET_CATEGORIES = [
  "assistenza",
  "guasto",
  "manutenzione",
  "reclamo",
  "informazione",
  "altro",
] as const;

export type ServiceTicketCategory = (typeof SERVICE_TICKET_CATEGORIES)[number];

export const SERVICE_TICKET_CATEGORY_LABELS: Record<ServiceTicketCategory, string> = {
  assistenza: "Assistenza generica",
  guasto: "Guasto",
  manutenzione: "Manutenzione",
  reclamo: "Reclamo",
  informazione: "Richiesta informazioni",
  altro: "Altro",
};

export const SERVICE_TICKET_CATEGORY_OPTIONS = SERVICE_TICKET_CATEGORIES.map((value) => ({
  value,
  label: SERVICE_TICKET_CATEGORY_LABELS[value],
}));

export function getServiceTicketCategoryLabel(value: string): string {
  return (
    SERVICE_TICKET_CATEGORY_LABELS[value as ServiceTicketCategory] ?? value
  );
}

export const SERVICE_TICKET_PRIORITY_LABELS: Record<ActivityPriority, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
};

export const SERVICE_TICKET_PRIORITY_OPTIONS: Array<{
  value: ActivityPriority;
  label: string;
}> = [
  { value: "low", label: "Bassa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

export function isServiceTicketPriority(value: string | undefined): value is ActivityPriority {
  return value === "low" || value === "medium" || value === "high";
}

export interface ServiceTicketFilters {
  companyId?: string;
  productId?: string;
  agentId?: string;
  status?: ServiceTicketStatus;
  priority?: ActivityPriority;
}

export function parseServiceTicketFilters(input: {
  company?: string;
  product?: string;
  agent?: string;
  status?: string;
  priority?: string;
}): ServiceTicketFilters {
  const filters: ServiceTicketFilters = {};

  if (input.company?.trim()) {
    filters.companyId = input.company.trim();
  }
  if (input.product?.trim()) {
    filters.productId = input.product.trim();
  }
  if (input.agent?.trim()) {
    filters.agentId = input.agent.trim();
  }
  if (isServiceTicketStatus(input.status)) {
    filters.status = input.status;
  }
  if (isServiceTicketPriority(input.priority)) {
    filters.priority = input.priority;
  }

  return filters;
}
