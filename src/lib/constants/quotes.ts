import type { OpportunityStatus } from "@/lib/supabase/types";

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
] as const satisfies readonly OpportunityStatus[];

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Bozza",
  sent: "Inviato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  expired: "Scaduto",
  cancelled: "Annullato",
};

export const QUOTE_STATUS_OPTIONS = QUOTE_STATUSES.map((value) => ({
  value,
  label: QUOTE_STATUS_LABELS[value],
}));

const STATUS_SET = new Set<string>(QUOTE_STATUSES);

export function isQuoteStatus(value: string | undefined): value is QuoteStatus {
  return value != null && STATUS_SET.has(value);
}

export interface QuoteFilters {
  status?: QuoteStatus;
  companyId?: string;
  agentId?: string;
}

export function parseQuoteFilters(input: {
  status?: string;
  company?: string;
  agent?: string;
}): QuoteFilters {
  const filters: QuoteFilters = {};

  if (isQuoteStatus(input.status)) {
    filters.status = input.status;
  }
  if (input.company?.trim()) {
    filters.companyId = input.company.trim();
  }
  if (input.agent?.trim()) {
    filters.agentId = input.agent.trim();
  }

  return filters;
}

export function quoteStatusVariant(
  status: QuoteStatus
): "muted" | "info" | "success" | "warning" | "danger" {
  if (status === "accepted") {
    return "success";
  }
  if (status === "sent") {
    return "info";
  }
  if (status === "draft") {
    return "muted";
  }
  if (status === "expired") {
    return "warning";
  }
  if (status === "rejected" || status === "cancelled") {
    return "danger";
  }
  return "muted";
}
