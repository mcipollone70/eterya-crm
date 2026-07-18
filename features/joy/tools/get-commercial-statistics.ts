import "server-only";

import { getStatistics, type JoyStatisticsSnapshot } from "./get-statistics";
import { getQuotes } from "./get-quotes";
import { getOrders } from "./get-orders";
import { getSamples } from "./get-samples";
import { getServiceTickets } from "./get-service-tickets";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyCommercialStatisticsSnapshot extends JoyStatisticsSnapshot {
  quoteCount: number;
  orderCount: number;
  samplesOutstanding: number;
  openServiceTickets: number;
}

export async function getCommercialStatistics(): Promise<
  JoyToolResult<JoyCommercialStatisticsSnapshot | null>
> {
  try {
    const [statsResult, quotesResult, ordersResult, samplesResult, ticketsResult] =
      await Promise.all([
        getStatistics(),
        getQuotes({ limit: 1 }),
        getOrders({ limit: 1 }),
        getSamples(),
        getServiceTickets(),
      ]);

    if (!statsResult.hasData || !statsResult.data) {
      return emptyToolResult(null, statsResult.error);
    }

    return successToolResult({
      ...statsResult.data,
      quoteCount: quotesResult.data?.quoteCount ?? 0,
      orderCount: ordersResult.data?.orderCount ?? 0,
      samplesOutstanding: samplesResult.data?.outstanding ?? 0,
      openServiceTickets: ticketsResult.data?.open ?? 0,
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare le statistiche commerciali."
    );
  }
}
