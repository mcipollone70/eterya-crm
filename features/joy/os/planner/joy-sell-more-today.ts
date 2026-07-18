/**
 * Sell-more-today plan — merges agenda signals + radar into one ranked day narrative.
 * Answers «come vendiamo di più oggi?» with transparent CRM evidence only.
 */

import "server-only";

import { getDailyPlan, getDailyBriefing, JOY_INSUFFICIENT_DATA_MESSAGE } from "@/features/joy/tools";
import { buildCommercialRadar } from "../radar/joy-commercial-radar";
import { formatDecisionTransparency } from "../decision/joy-decision-engine";
import type { JoyOsDecision } from "../types";

export interface JoySellMoreTodayResult {
  headline: string;
  narrative: string;
  topActions: JoyOsDecision[];
  dataQuality: "sufficient" | "partial" | "insufficient";
}

export async function buildSellMoreTodayPlan(options: {
  userId: string | null;
  latitude?: number | null;
  longitude?: number | null;
  freeMinutes?: number | null;
  cancelledVisitCount?: number;
  earlyFinish?: boolean;
}): Promise<JoySellMoreTodayResult> {
  const [briefing, plan, radar] = await Promise.all([
    getDailyBriefing({ userId: options.userId }),
    getDailyPlan({ userId: options.userId }),
    buildCommercialRadar({
      userId: options.userId,
      latitude: options.latitude,
      longitude: options.longitude,
      freeMinutes: options.freeMinutes,
      cancelledVisitCount: options.cancelledVisitCount,
      earlyFinish: options.earlyFinish,
      triggers: ["general", "free_time", "position", "urgent_follow_up", "quote_expiry"],
    }),
  ]);

  const visitsToday =
    briefing.data?.statistics?.visitsToday ??
    briefing.data?.visitsToday.length ??
    0;
  const overdue =
    briefing.data?.statistics?.overdueFollowUps ??
    briefing.data?.overdueFollowUps.length ??
    0;

  const topActions = radar.proposals.slice(0, 5);
  const hasSignals =
    topActions.length > 0 || visitsToday > 0 || overdue > 0 || Boolean(plan.data?.items?.length);

  if (!hasSignals) {
    return {
      headline: "Come vendiamo di più oggi — dati insufficienti",
      narrative: JOY_INSUFFICIENT_DATA_MESSAGE,
      topActions: [],
      dataQuality: "insufficient",
    };
  }

  const lines = [
    "**Come vendiamo di più oggi?** (piano operativo, stime non promesse)",
    "",
    `Contesto: **${visitsToday}** visite in agenda · **${overdue}** follow-up scaduti.`,
  ];

  if (plan.hasData && plan.data?.summaryText) {
    lines.push("", plan.data.summaryText);
  }

  if (topActions.length > 0) {
    lines.push("", "Leve commerciali consigliate adesso:");
    for (const [index, decision] of topActions.entries()) {
      lines.push(
        `${index + 1}. **${decision.title}** → «${decision.action}»`,
        `   Motivo: ${decision.reason}`,
        `   Dati: ${decision.dataUsed.join(", ") || "n/d"} · Urgenza ${decision.urgency} · Confidenza ${decision.confidence}`
      );
      if (decision.missingData.length > 0) {
        lines.push(`   Mancanti: ${decision.missingData.join(", ")}`);
      }
    }
  }

  lines.push(
    "",
    "Nessuna azione salvata. Dimmi il numero, «organizza il giro», o «simula focus VEPA»."
  );

  return {
    headline: "Piano: vendere di più oggi",
    narrative: lines.join("\n"),
    topActions,
    dataQuality: topActions.length >= 2 ? "sufficient" : "partial",
  };
}

export function formatSellMoreTodayDetail(decision: JoyOsDecision): string {
  return formatDecisionTransparency(decision);
}
