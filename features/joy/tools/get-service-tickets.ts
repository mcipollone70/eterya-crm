import "server-only";

import { listServiceTickets } from "@/features/service/services/service-tickets.service";
import { SERVICE_TICKET_STATUS_LABELS } from "@/lib/constants/service-tickets";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyServiceTicketsSnapshot {
  total: number;
  open: number;
  resolved: number;
  recentTickets: Array<{
    id: string;
    title: string;
    companyName: string | null;
    status: string;
    openedAt: string;
  }>;
}

export async function getServiceTickets(): Promise<JoyToolResult<JoyServiceTicketsSnapshot | null>> {
  try {
    const { data, count, error } = await listServiceTickets({ limit: 50 });

    if (error) {
      return emptyToolResult(null, error);
    }

    return successToolResult({
      total: count,
      open: (data ?? []).filter(
        (item) => item.status !== "chiuso" && item.status !== "risolto"
      ).length,
      resolved: (data ?? []).filter(
        (item) => item.status === "risolto" || item.status === "chiuso"
      ).length,
      recentTickets: (data ?? []).slice(0, 8).map((item) => ({
        id: item.id,
        title: item.title,
        companyName: item.company_name,
        status: SERVICE_TICKET_STATUS_LABELS[item.status],
        openedAt: item.opened_at,
      })),
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare i ticket di assistenza."
    );
  }
}
