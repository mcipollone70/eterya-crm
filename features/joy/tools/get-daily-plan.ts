import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { getUserScopedTodayVisitPlan } from "@/features/dashboard/services/mission-control.service";
import type { JoyDayPlanItem } from "@/features/joy/types/joy-data";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyDailyPlanSnapshot {
  stops: number;
  items: JoyDayPlanItem[];
  summaryText: string;
}

export async function getDailyPlan(options?: {
  userId?: string | null;
}): Promise<JoyToolResult<JoyDailyPlanSnapshot | null>> {
  try {
    const userId = options?.userId ?? (await getCurrentUser())?.id ?? null;
    if (!userId) {
      return emptyToolResult(null, "Utente non autenticato.");
    }

    const items = await getUserScopedTodayVisitPlan(userId);

    if (items.length === 0) {
      return successToolResult({
        stops: 0,
        items: [],
        summaryText:
          "Nessuna tappa nel piano di oggi. Pianifica visite in Agenda o chiedi «Prepara la mia giornata» per il briefing.",
      });
    }

    const lines = items.map(
      (item, index) =>
        `• **${index + 1}. ${item.companyName}**${
          item.city ? ` (${item.city})` : ""
        } — ${item.scheduledLabel}`
    );

    return successToolResult({
      stops: items.length,
      items,
      summaryText: `**Piano della giornata** — ${items.length} tappe:\n${lines.join("\n")}`,
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare il piano della giornata."
    );
  }
}
