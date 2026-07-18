import "server-only";

import { listOpportunities } from "@/features/opportunities/services/opportunities.service";
import {
  formatOpportunityAmount,
  isOpenOpportunityStage,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/constants/opportunity-pipeline";
import { computeStageTotals } from "@/lib/opportunities/stage-totals";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyPipelineStageSnapshot {
  stage: string;
  label: string;
  count: number;
  totalAmount: string;
}

export interface JoyPipelineSnapshot {
  openCount: number;
  openValue: string;
  totalCount: number;
  stages: JoyPipelineStageSnapshot[];
}

export async function getPipeline(): Promise<JoyToolResult<JoyPipelineSnapshot | null>> {
  try {
    const { data, count, error } = await listOpportunities({ limit: 500 });

    if (error) {
      return emptyToolResult(null, error);
    }

    const open = (data ?? []).filter((item) => isOpenOpportunityStage(item.stage));
    const openValue = open.reduce((sum, item) => sum + item.total_amount, 0);
    const stages = computeStageTotals(data ?? [])
      .filter((entry) => entry.count > 0)
      .map((entry) => ({
        stage: entry.stage,
        label: OPPORTUNITY_STAGE_LABELS[entry.stage],
        count: entry.count,
        totalAmount: formatOpportunityAmount(entry.totalAmount),
      }));

    return successToolResult({
      openCount: open.length,
      openValue: formatOpportunityAmount(openValue),
      totalCount: count,
      stages,
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare la pipeline."
    );
  }
}
