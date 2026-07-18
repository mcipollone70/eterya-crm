import "server-only";

import { listOrders } from "@/features/orders/services/orders.service";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyOrdersSnapshot {
  orderCount: number;
  totalValue: string;
  recentOrders: Array<{
    id: string;
    title: string;
    companyName: string | null;
    amount: string;
    acceptedAt: string | null;
  }>;
}

export interface GetOrdersOptions {
  companyId?: string;
  limit?: number;
}

export async function getOrders(
  options: GetOrdersOptions = {}
): Promise<JoyToolResult<JoyOrdersSnapshot | null>> {
  try {
    const { data, count, error } = await listOrders({
      filters: options.companyId ? { companyId: options.companyId } : undefined,
      limit: options.limit ?? 20,
    });

    if (error) {
      return emptyToolResult(null, error);
    }

    const totalValue = (data ?? []).reduce((sum, item) => sum + item.total_amount, 0);

    return successToolResult({
      orderCount: count,
      totalValue: formatOpportunityAmount(totalValue),
      recentOrders: (data ?? []).slice(0, 8).map((item) => ({
        id: item.id,
        title: item.title,
        companyName: item.company_name,
        amount: formatOpportunityAmount(item.total_amount, item.currency),
        acceptedAt: item.accepted_at,
      })),
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare gli ordini."
    );
  }
}
