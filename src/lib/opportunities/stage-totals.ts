import {
  formatOpportunityAmount,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "@/lib/constants/opportunity-pipeline";

export interface OpportunityStageTotal {
  stage: OpportunityStage;
  count: number;
  totalAmount: number;
}

export interface OpportunityWithAmount {
  stage: OpportunityStage;
  total_amount: number;
  currency?: string;
}

export function computeStageTotals<T extends OpportunityWithAmount>(
  items: T[]
): OpportunityStageTotal[] {
  const totals = Object.fromEntries(
    OPPORTUNITY_STAGES.map((stage) => [stage, { count: 0, totalAmount: 0 }])
  ) as Record<OpportunityStage, { count: number; totalAmount: number }>;

  for (const item of items) {
    totals[item.stage].count += 1;
    totals[item.stage].totalAmount += Number(item.total_amount ?? 0);
  }

  return OPPORTUNITY_STAGES.map((stage) => ({
    stage,
    count: totals[stage].count,
    totalAmount: totals[stage].totalAmount,
  }));
}

export function sumPipelineValue(items: OpportunityWithAmount[]): number {
  return items.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0);
}

export function formatStageTotalLabel(count: number, totalAmount: number, currency = "EUR"): string {
  return `${count.toLocaleString("it-IT")} opportunità · ${formatOpportunityAmount(totalAmount, currency)}`;
}
