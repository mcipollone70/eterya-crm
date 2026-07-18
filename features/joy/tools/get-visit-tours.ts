import "server-only";

import { listVisitTours } from "@/features/routes/services/visit-tour-saved.service";
import type { VisitTourListItem } from "@/features/routes/types/visit-tour";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface GetVisitToursOptions {
  userId?: string | null;
  tourDate?: string | null;
  limit?: number;
}

export async function getVisitTours(
  options: GetVisitToursOptions = {}
): Promise<JoyToolResult<VisitTourListItem[]>> {
  const { data, error } = await listVisitTours({
    agentId: options.userId ?? undefined,
    tourDate: options.tourDate ?? undefined,
    sortBy: "date",
    sortAscending: false,
  });

  if (error) {
    if (/visit_tours/i.test(error) && /does not exist|relation/i.test(error)) {
      return emptyToolResult([]);
    }
    return emptyToolResult([], error);
  }

  const limit = options.limit ?? 10;
  const rows = (data ?? []).slice(0, limit);
  return successToolResult(rows);
}
