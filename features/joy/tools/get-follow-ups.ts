import "server-only";

import {
  listFollowUps,
  type FollowUpListItem,
} from "@/features/activities/services/follow-ups.service";
import type { FollowUpPeriod } from "@/lib/constants/follow-up";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyFollowUpRecord {
  id: string;
  companyId: string;
  companyName: string | null;
  contactName: string | null;
  description: string | null;
  priority: string;
  status: string;
  scheduledAt: string;
  effectiveAt: string;
}

export interface GetFollowUpsOptions {
  companyId?: string;
  period?: FollowUpPeriod | null;
  limit?: number;
}

function mapFollowUp(item: FollowUpListItem): JoyFollowUpRecord {
  return {
    id: item.id,
    companyId: item.company_id,
    companyName: item.company_name,
    contactName: item.contact_name,
    description: item.description,
    priority: item.priority,
    status: item.status,
    scheduledAt: item.scheduled_at,
    effectiveAt: item.effective_at,
  };
}

export async function getFollowUps(
  options: GetFollowUpsOptions = {}
): Promise<JoyToolResult<{ rows: JoyFollowUpRecord[]; total: number }>> {
  const limit = options.limit ?? 12;

  try {
    const { data, error } = await listFollowUps({
      companyId: options.companyId,
      period: options.period ?? null,
      limit,
    });

    if (error) {
      return emptyToolResult({ rows: [], total: 0 }, error);
    }

    const rows = (data ?? []).map(mapFollowUp);
    return successToolResult({ rows, total: rows.length });
  } catch (error) {
    return emptyToolResult(
      { rows: [], total: 0 },
      error instanceof Error ? error.message : "Impossibile caricare i follow-up."
    );
  }
}

export async function getOverdueFollowUps(
  options: Omit<GetFollowUpsOptions, "period"> = {}
): Promise<JoyToolResult<{ rows: JoyFollowUpRecord[]; total: number }>> {
  return getFollowUps({ ...options, period: "overdue" });
}
