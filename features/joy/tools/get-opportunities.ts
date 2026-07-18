import "server-only";

import {
  listOpportunities,
  type OpportunityListItem,
} from "@/features/opportunities/services/opportunities.service";
import {
  formatOpportunityAmount,
  isOpenOpportunityStage,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/constants/opportunity-pipeline";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export const STALE_OPPORTUNITY_DAYS = 21;

export interface JoyOpportunityRecord {
  id: string;
  companyId: string;
  companyName: string | null;
  title: string;
  stage: string;
  stageLabel: string;
  totalAmount: string;
  updatedAt: string;
  idleDays: number | null;
}

export interface GetOpportunitiesOptions {
  companyId?: string;
  limit?: number;
}

function daysSince(iso: string | null): number | null {
  if (!iso) {
    return null;
  }
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function mapOpportunity(item: OpportunityListItem): JoyOpportunityRecord {
  return {
    id: item.id,
    companyId: item.company_id,
    companyName: item.company_name,
    title: item.title,
    stage: item.stage,
    stageLabel: OPPORTUNITY_STAGE_LABELS[item.stage],
    totalAmount: formatOpportunityAmount(item.total_amount, item.currency),
    updatedAt: item.updated_at,
    idleDays: daysSince(item.updated_at),
  };
}

export async function getOpportunities(
  options: GetOpportunitiesOptions = {}
): Promise<JoyToolResult<{ rows: JoyOpportunityRecord[]; total: number; openValue: string }>> {
  const limit = options.limit ?? 12;

  try {
    const { data, count, error } = await listOpportunities({
      companyId: options.companyId,
      limit: 500,
    });

    if (error) {
      return emptyToolResult({ rows: [], total: 0, openValue: formatOpportunityAmount(0) }, error);
    }

    const open = (data ?? []).filter((item) => isOpenOpportunityStage(item.stage));
    const totalValue = open.reduce((sum, item) => sum + item.total_amount, 0);
    const rows = open.slice(0, limit).map(mapOpportunity);

    return successToolResult({
      rows,
      total: options.companyId ? open.length : (count ?? open.length),
      openValue: formatOpportunityAmount(totalValue),
    });
  } catch (error) {
    return emptyToolResult(
      { rows: [], total: 0, openValue: formatOpportunityAmount(0) },
      error instanceof Error ? error.message : "Impossibile caricare le opportunità."
    );
  }
}

export async function getStaleOpportunities(
  options: GetOpportunitiesOptions & { staleDays?: number } = {}
): Promise<JoyToolResult<{ rows: JoyOpportunityRecord[]; total: number }>> {
  const staleDays = options.staleDays ?? STALE_OPPORTUNITY_DAYS;
  const limit = options.limit ?? 12;

  try {
    const { data, error } = await listOpportunities({
      companyId: options.companyId,
      limit: 500,
    });

    if (error) {
      return emptyToolResult({ rows: [], total: 0 }, error);
    }

    const stale = (data ?? [])
      .filter((item) => {
        if (!isOpenOpportunityStage(item.stage)) {
          return false;
        }
        const idle = daysSince(item.updated_at);
        return idle != null && idle >= staleDays;
      })
      .sort((a, b) => (daysSince(b.updated_at) ?? 0) - (daysSince(a.updated_at) ?? 0));

    const rows = stale.slice(0, limit).map(mapOpportunity);
    return successToolResult({ rows, total: stale.length });
  } catch (error) {
    return emptyToolResult(
      { rows: [], total: 0 },
      error instanceof Error ? error.message : "Impossibile caricare le opportunità ferme."
    );
  }
}
