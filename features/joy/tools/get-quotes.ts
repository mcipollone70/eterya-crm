import "server-only";

import { listQuotes } from "@/features/quotes/services/quotes.service";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { QUOTE_STATUS_LABELS } from "@/lib/constants/quotes";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyQuoteRecord {
  id: string;
  companyId: string;
  companyName: string | null;
  title: string;
  number: string | null;
  status: string;
  statusLabel: string;
  totalAmount: string;
  sentAt: string | null;
  updatedAt: string;
}

export interface GetQuotesOptions {
  companyId?: string;
  limit?: number;
}

export interface JoyQuotesSnapshot {
  quoteCount: number;
  totalValue: string;
  recentQuotes: JoyQuoteRecord[];
}

export async function getQuotes(
  options: GetQuotesOptions = {}
): Promise<JoyToolResult<JoyQuotesSnapshot | null>> {
  const limit = options.limit ?? 12;

  try {
    const { data, count, error } = await listQuotes({
      filters: options.companyId ? { companyId: options.companyId } : undefined,
      limit: Math.max(limit, 20),
    });

    if (error) {
      return emptyToolResult(null, error);
    }

    const rows = data ?? [];
    const totalValue = rows.reduce((sum, item) => sum + item.total_amount, 0);

    return successToolResult({
      quoteCount: count,
      totalValue: formatOpportunityAmount(totalValue),
      recentQuotes: rows.slice(0, limit).map((item) => ({
        id: item.id,
        companyId: item.company_id,
        companyName: item.company_name,
        title: item.title,
        number: item.number,
        status: item.status,
        statusLabel: QUOTE_STATUS_LABELS[item.status] ?? item.status,
        totalAmount: formatOpportunityAmount(item.total_amount, item.currency),
        sentAt: item.sent_at,
        updatedAt: item.updated_at,
      })),
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare i preventivi."
    );
  }
}
