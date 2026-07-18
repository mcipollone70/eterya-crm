import type { OpportunityStage } from "@/lib/constants/opportunity-pipeline";

export interface CommercialKpiStageValue {
  stage: OpportunityStage;
  label: string;
  count: number;
  value: number;
}

export interface CommercialKpiData {
  pipelineValue: number;
  openOpportunities: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number;
  stageValues: CommercialKpiStageValue[];
  quotesSent: number;
  quotesAccepted: number;
  quotesSentValue: number;
  quotesAcceptedValue: number;
  quoteAcceptanceRate: number;
  ordersCount: number;
  ordersValue: number;
  samplesOutstanding: number;
  samplesPurchased: number;
  serviceOpenTickets: number;
  error: string | null;
}
