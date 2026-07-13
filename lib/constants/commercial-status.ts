import type { BadgeVariant } from "@/components/ui/badge";
import type { CommercialStatus } from "@/lib/supabase/types";

/** Etichette UI per lo stato commerciale — distinto da `company_status`. */
export const COMMERCIAL_STATUS_LABELS: Record<CommercialStatus, string> = {
  prospect: "Prospect",
  cliente: "Cliente",
  ex_cliente: "Ex Cliente",
  da_ricontattare: "Da ricontattare",
  non_interessato: "Non interessato",
};

export const COMMERCIAL_STATUS_BADGE_VARIANT: Record<CommercialStatus, BadgeVariant> = {
  prospect: "info",
  cliente: "success",
  ex_cliente: "muted",
  da_ricontattare: "warning",
  non_interessato: "danger",
};

export const COMMERCIAL_STATUS_OPTIONS = (
  Object.keys(COMMERCIAL_STATUS_LABELS) as CommercialStatus[]
).map((value) => ({ value, label: COMMERCIAL_STATUS_LABELS[value] }));

/** Stati inclusi nei KPI della dashboard (escluso "Non interessato"). */
export type DashboardCommercialStatus = Exclude<CommercialStatus, "non_interessato">;

export const DASHBOARD_COMMERCIAL_STATUSES: DashboardCommercialStatus[] = [
  "prospect",
  "cliente",
  "ex_cliente",
  "da_ricontattare",
];

export const DASHBOARD_COMMERCIAL_STATUS_LABELS: Record<DashboardCommercialStatus, string> = {
  prospect: "Totale Prospect",
  cliente: "Totale Clienti",
  ex_cliente: "Totale Ex Clienti",
  da_ricontattare: "Totale Da ricontattare",
};

const COMMERCIAL_STATUS_SET = new Set<string>(
  Object.keys(COMMERCIAL_STATUS_LABELS)
);

export function isCommercialStatus(value: string | undefined): value is CommercialStatus {
  return value != null && COMMERCIAL_STATUS_SET.has(value);
}

/** Righe legacy senza backfill: trattate come Prospect in elenco e filtri. */
export function normalizeCommercialStatus(
  status: CommercialStatus | null | undefined
): CommercialStatus {
  return status ?? "prospect";
}
