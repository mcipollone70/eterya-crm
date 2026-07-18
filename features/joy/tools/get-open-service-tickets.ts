import "server-only";

import { listServiceTickets } from "@/features/service/services/service-tickets.service";
import {
  SERVICE_TICKET_PRIORITY_LABELS,
  SERVICE_TICKET_STATUS_LABELS,
} from "@/lib/constants/service-tickets";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

const CLOSED_STATUSES = new Set(["chiuso", "risolto"]);

export interface JoyOpenServiceTicket {
  id: string;
  title: string;
  companyId: string;
  companyName: string | null;
  status: string;
  priority: string;
  openedAt: string;
}

export interface JoyOpenServiceTicketsSnapshot {
  count: number;
  highPriority: number;
  tickets: JoyOpenServiceTicket[];
  summaryText: string;
}

export async function getOpenServiceTickets(options?: {
  companyId?: string;
  limit?: number;
}): Promise<JoyToolResult<JoyOpenServiceTicketsSnapshot | null>> {
  const limit = options?.limit ?? 30;

  try {
    const { data, error } = await listServiceTickets({
      filters: { companyId: options?.companyId },
      limit: 200,
    });

    if (error) {
      return emptyToolResult(null, error);
    }

    const open = (data ?? [])
      .filter((item) => !CLOSED_STATUSES.has(item.status))
      .map((item) => ({
        id: item.id,
        title: item.title,
        companyId: item.company_id,
        companyName: item.company_name,
        status: SERVICE_TICKET_STATUS_LABELS[item.status],
        priority: SERVICE_TICKET_PRIORITY_LABELS[item.priority],
        openedAt: item.opened_at,
      }))
      .slice(0, limit);

    const highPriority = (data ?? []).filter(
      (item) => !CLOSED_STATUSES.has(item.status) && item.priority === "high"
    ).length;

    if (open.length === 0) {
      return successToolResult({
        count: 0,
        highPriority: 0,
        tickets: [],
        summaryText: "Nessun ticket di assistenza aperto.",
      });
    }

    const lines = open.map(
      (item) =>
        `• **${item.companyName ?? "Azienda"}** — ${item.title} (${item.status} · ${item.priority})`
    );

    return successToolResult({
      count: open.length,
      highPriority,
      tickets: open,
      summaryText: `Ticket aperti: **${open.length}**${
        highPriority > 0 ? ` · ${highPriority} ad alta priorità` : ""
      }.\n\n${lines.join("\n")}`,
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare i ticket aperti."
    );
  }
}
