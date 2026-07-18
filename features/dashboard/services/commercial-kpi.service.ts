import "server-only";

import { cache } from "react";
import { getOpportunityDashboardMetrics } from "@/features/opportunities/services/opportunities.service";
import { listOpportunities } from "@/features/opportunities/services/opportunities.service";
import { getQuotesDashboardMetrics } from "@/features/quotes/services/quotes.service";
import { getOrderDashboardMetrics } from "@/features/orders/services/orders.service";
import { getSamplesDashboardMetrics } from "@/features/samples/services/samples.service";
import { getServiceTicketsDashboardMetrics } from "@/features/service/services/service-tickets.service";
import { OPPORTUNITY_STAGE_LABELS } from "@/lib/constants/opportunity-pipeline";
import { computeStageTotals } from "@/lib/opportunities/stage-totals";
import type { CommercialKpiData } from "../types/commercial-kpi";

const EMPTY_KPI: CommercialKpiData = {
  pipelineValue: 0,
  openOpportunities: 0,
  wonCount: 0,
  lostCount: 0,
  conversionRate: 0,
  stageValues: [],
  quotesSent: 0,
  quotesAccepted: 0,
  quotesSentValue: 0,
  quotesAcceptedValue: 0,
  quoteAcceptanceRate: 0,
  ordersCount: 0,
  ordersValue: 0,
  samplesOutstanding: 0,
  samplesPurchased: 0,
  serviceOpenTickets: 0,
  error: null,
};

export const getCommercialKpiData = cache(async (): Promise<CommercialKpiData> => {
  try {
    const [
      opportunityMetrics,
      opportunitiesList,
      quotesMetrics,
      ordersMetrics,
      samplesMetrics,
      serviceMetrics,
    ] = await Promise.all([
      getOpportunityDashboardMetrics(),
      listOpportunities({ limit: 1000 }),
      getQuotesDashboardMetrics(),
      getOrderDashboardMetrics(),
      getSamplesDashboardMetrics(),
      getServiceTicketsDashboardMetrics(),
    ]);

    const wonCount = opportunityMetrics.data?.wonCount ?? 0;
    const lostCount = opportunityMetrics.data?.lostCount ?? 0;
    const closedCount = wonCount + lostCount;
    const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

    const stageValues = computeStageTotals(opportunitiesList.data ?? [])
      .filter((entry) => entry.stage !== "won" && entry.stage !== "lost")
      .map((entry) => ({
        stage: entry.stage,
        label: OPPORTUNITY_STAGE_LABELS[entry.stage],
        count: entry.count,
        value: entry.totalAmount,
      }));

    const quotesSent = quotesMetrics.data.sent;
    const quotesAccepted = quotesMetrics.data.accepted;
    const quoteDenominator = quotesSent + quotesAccepted;
    const quoteAcceptanceRate =
      quoteDenominator > 0 ? Math.round((quotesAccepted / quoteDenominator) * 100) : 0;

    const error =
      opportunityMetrics.error ??
      opportunitiesList.error ??
      quotesMetrics.error ??
      ordersMetrics.error ??
      samplesMetrics.error ??
      serviceMetrics.error ??
      null;

    return {
      pipelineValue: opportunityMetrics.data?.pipelineValue ?? 0,
      openOpportunities: opportunityMetrics.data?.openCount ?? 0,
      wonCount,
      lostCount,
      conversionRate,
      stageValues,
      quotesSent,
      quotesAccepted,
      quotesSentValue: quotesMetrics.data.sentValue,
      quotesAcceptedValue: quotesMetrics.data.acceptedValue,
      quoteAcceptanceRate,
      ordersCount: ordersMetrics.data.orderCount,
      ordersValue: ordersMetrics.data.totalValue,
      samplesOutstanding: samplesMetrics.data.outstanding,
      samplesPurchased: samplesMetrics.data.purchased,
      serviceOpenTickets: serviceMetrics.data.open,
      error,
    };
  } catch (error) {
    return {
      ...EMPTY_KPI,
      error: error instanceof Error ? error.message : "Impossibile caricare i KPI commerciali.",
    };
  }
});
