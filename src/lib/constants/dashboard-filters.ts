import type { CommercialStatus } from "@/lib/supabase/types";

export const DASHBOARD_PERIOD_OPTIONS = [
  { value: "", label: "Periodo predefinito" },
  { value: "7d", label: "Ultimi 7 giorni" },
  { value: "30d", label: "Ultimi 30 giorni" },
  { value: "90d", label: "Ultimi 90 giorni" },
  { value: "ytd", label: "Anno corrente" },
  { value: "12m", label: "Ultimi 12 mesi" },
] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIOD_OPTIONS)[number]["value"];

const DASHBOARD_PERIOD_SET = new Set<string>(
  DASHBOARD_PERIOD_OPTIONS.map((option) => option.value).filter(Boolean)
);

const COMMERCIAL_STATUS_SET = new Set<string>([
  "prospect",
  "cliente",
  "ex_cliente",
  "da_ricontattare",
  "non_interessato",
]);

export interface CommercialDashboardFilters {
  agentId: string | null;
  province: string | null;
  commercialStatus: CommercialStatus | null;
  period: DashboardPeriod;
}

export interface DashboardFilterOptions {
  agents: Array<{ id: string; label: string }>;
  provinces: string[];
}

export function isDashboardPeriod(value: string | undefined): value is DashboardPeriod {
  if (!value) {
    return true;
  }
  return DASHBOARD_PERIOD_SET.has(value);
}

export function isDashboardCommercialStatus(
  value: string | undefined
): value is CommercialStatus {
  return value != null && COMMERCIAL_STATUS_SET.has(value);
}

export function hasActiveDashboardFilters(filters: CommercialDashboardFilters): boolean {
  return Boolean(
    filters.agentId || filters.province || filters.commercialStatus || filters.period
  );
}

export function parseDashboardFilters(input: {
  agent?: string;
  province?: string;
  status?: string;
  period?: string;
}): CommercialDashboardFilters {
  return {
    agentId: input.agent?.trim() || null,
    province: input.province?.trim() || null,
    commercialStatus: isDashboardCommercialStatus(input.status) ? input.status : null,
    period: isDashboardPeriod(input.period) ? (input.period ?? "") : "",
  };
}

export function buildDashboardFilterQuery(filters: CommercialDashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.agentId) {
    params.set("agent", filters.agentId);
  }
  if (filters.province) {
    params.set("province", filters.province);
  }
  if (filters.commercialStatus) {
    params.set("status", filters.commercialStatus);
  }
  if (filters.period) {
    params.set("period", filters.period);
  }
  return params.toString();
}
