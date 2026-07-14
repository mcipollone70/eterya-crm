import {
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "@/lib/constants/opportunity-pipeline";

export interface OpportunityKanbanItem {
  id: string;
  stage: OpportunityStage;
}

export function groupOpportunitiesByStage<T extends OpportunityKanbanItem>(
  items: T[]
): Record<OpportunityStage, T[]> {
  const grouped = Object.fromEntries(
    OPPORTUNITY_STAGES.map((stage) => [stage, [] as T[]])
  ) as Record<OpportunityStage, T[]>;

  for (const item of items) {
    grouped[item.stage].push(item);
  }

  return grouped;
}
