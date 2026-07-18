import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import { startOfWeekIso, endOfTodayIso } from "@/lib/last-visit/format";
import { emptyToolResult, isMissingTableError, successToolResult, type JoyToolResult } from "./types";

export interface JoyVisitRecord {
  id: string;
  companyId: string;
  companyName: string;
  city: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  status: string;
}

export interface GetVisitsOptions {
  userId?: string | null;
  companyId?: string;
  period?: "today" | "week" | "overdue";
  limit?: number;
}

export async function getVisits(
  options: GetVisitsOptions = {}
): Promise<JoyToolResult<{ rows: JoyVisitRecord[]; total: number }>> {
  const limit = options.limit ?? 12;
  const supabase = await createServerClient();

  let query = supabase
    .from("visits")
    .select("id,company_id,scheduled_at,completed_at,status,companies(name,city)", {
      count: "exact",
    })
    .order("scheduled_at", { ascending: false })
    .limit(limit);

  if (options.userId) {
    query = query.eq("user_id", options.userId);
  }

  if (options.companyId) {
    query = query.eq("company_id", options.companyId);
  }

  if (options.period === "week") {
    query = query
      .eq("status", "completed")
      .gte("completed_at", startOfWeekIso())
      .lte("completed_at", endOfTodayIso())
      .order("completed_at", { ascending: false });
  } else if (options.period === "today") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    query = query
      .in("status", ["scheduled", "in_progress", "completed"])
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString())
      .order("scheduled_at", { ascending: true });
  } else if (options.period === "overdue") {
    query = query
      .in("status", ["scheduled", "in_progress"])
      .lt("scheduled_at", new Date().toISOString());
  }

  const { data, count, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return emptyToolResult({ rows: [], total: 0 });
    }
    return emptyToolResult({ rows: [], total: 0 }, describeDbError(error));
  }

  type VisitRow = {
    id: string;
    company_id: string;
    scheduled_at: string;
    completed_at: string | null;
    status: string;
    companies:
      | { name: string; city: string | null }
      | Array<{ name: string; city: string | null }>
      | null;
  };

  const rows = (data ?? []).map((row) => {
    const visit = row as unknown as VisitRow;
    const company = Array.isArray(visit.companies) ? visit.companies[0] : visit.companies;
    return {
      id: visit.id,
      companyId: visit.company_id,
      companyName: company?.name ?? "Azienda",
      city: company?.city ?? null,
      scheduledAt: visit.scheduled_at,
      completedAt: visit.completed_at,
      status: visit.status,
    };
  });

  return successToolResult({ rows, total: count ?? rows.length });
}
