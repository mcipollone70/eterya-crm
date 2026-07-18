/**
 * Central planner facade — morning / midday / EOD / weekly / monthly.
 * Delegates to existing Joy tools; no duplicate CRM queries when avoidable.
 */

import "server-only";

import {
  getDailyBriefing,
  getDailyPlan,
  getEndOfDaySummary,
  getWeeklyBriefing,
  JOY_INSUFFICIENT_DATA_MESSAGE,
} from "@/features/joy/tools";
import { buildJoyStrategyInsight, formatStrategyInsight } from "../strategy/joy-strategy-engine";
import type { JoyOsTrigger } from "../types";

export type JoyPlanHorizon =
  | "morning"
  | "midday"
  | "evening"
  | "weekly"
  | "monthly";

export function resolvePlanHorizon(
  trigger?: JoyOsTrigger,
  hour = new Date().getHours()
): JoyPlanHorizon {
  if (trigger === "weekly") return "weekly";
  if (trigger === "monthly") return "monthly";
  if (trigger === "day_end") return "evening";
  if (trigger === "midday") return "midday";
  if (trigger === "day_start") return "morning";
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour >= 17) return "evening";
  return "midday";
}

export async function runJoyPlanner(options: {
  userId: string | null;
  companyId?: string | null;
  horizon?: JoyPlanHorizon;
  trigger?: JoyOsTrigger;
}): Promise<{ horizon: JoyPlanHorizon; summaryText: string }> {
  const horizon = options.horizon ?? resolvePlanHorizon(options.trigger);

  if (horizon === "morning") {
    const [briefing, plan] = await Promise.all([
      getDailyBriefing({
        userId: options.userId,
        companyId: options.companyId ?? undefined,
      }),
      getDailyPlan({ userId: options.userId }),
    ]);
    const parts: string[] = ["**Piano del mattino**", ""];
    if (briefing.hasData && briefing.data) {
      parts.push(
        `Visite oggi: **${briefing.data.statistics?.visitsToday ?? briefing.data.visitsToday.length ?? 0}**`,
        `Follow-up scaduti: **${briefing.data.statistics?.overdueFollowUps ?? briefing.data.overdueFollowUps.length ?? 0}**`,
        ""
      );
      if (briefing.data.suggestions?.length) {
        parts.push(
          "Ti consiglio queste priorità:",
          ...briefing.data.suggestions.slice(0, 4).map(
            (item) =>
              `• ${item.companyName}${item.city ? ` (${item.city})` : ""} — ${item.reason}`
          )
        );
      }
    } else {
      parts.push(briefing.error ?? JOY_INSUFFICIENT_DATA_MESSAGE);
    }
    if (plan.hasData && plan.data && plan.data.items.length > 0) {
      parts.push("", plan.data.summaryText);
    }
    parts.push("", "Vuoi che organizzi il giro? Dimmi zona e vincoli.");
    return { horizon, summaryText: parts.join("\n") };
  }

  if (horizon === "midday") {
    const plan = await getDailyPlan({ userId: options.userId });
    const parts = [
      "**Ricalibrazione di metà giornata**",
      "",
      "Ti consiglio di rivedere cosa resta in agenda e chi è vicino a te.",
    ];
    if (plan.hasData && plan.data && plan.data.items.length > 0) {
      parts.push("", plan.data.summaryText);
    } else {
      parts.push(
        "",
        "Agenda leggera: prova «Ho due ore libere» o «Cosa mi consigli di fare adesso?»."
      );
    }
    return { horizon, summaryText: parts.join("\n") };
  }

  if (horizon === "evening") {
    const eod = await getEndOfDaySummary({ userId: options.userId ?? undefined });
    if (!eod.hasData || !eod.data) {
      return {
        horizon,
        summaryText: eod.error ?? JOY_INSUFFICIENT_DATA_MESSAGE,
      };
    }
    const s = eod.data;
    return {
      horizon,
      summaryText: [
        `**Analisi di fine giornata** — ${s.dateLabel}`,
        "",
        `Visite completate: **${s.completedVisits.length}**`,
        `Follow-up completati: **${s.completedFollowUps.length}**`,
        `Attività registrate: **${s.activities.length}**`,
        `Agenda ancora aperta: **${s.agendaRemaining.length}**`,
        "",
        s.agendaRemaining.length > 0
          ? "Ti consiglio di chiudere o ripianificare ciò che resta in agenda."
          : "Giornata chiusa sul piano agenda — registra eventuali debrief in sospeso.",
      ].join("\n"),
    };
  }

  if (horizon === "weekly") {
    const weekly = await getWeeklyBriefing({ userId: options.userId ?? undefined });
    if (!weekly.hasData || !weekly.data) {
      return {
        horizon,
        summaryText: weekly.error ?? JOY_INSUFFICIENT_DATA_MESSAGE,
      };
    }
    const w = weekly.data;
    return {
      horizon,
      summaryText: [
        "**Strategia settimanale**",
        "",
        `Visite settimana: **${w.weekVisitsCount}**`,
        `Follow-up prossimi 7gg: **${w.followUpsNext7.length}**`,
        `Follow-up scaduti: **${w.overdueFollowUps.length}**`,
        `Pipeline aperta: **${w.openOpportunities}** · ${w.pipelineValue}`,
        `Preventivi: **${w.quoteCount}** · Ordini: **${w.orderCount}**`,
        "",
        "Ti consiglio di sbloccare stale e densificare le zone con clienti inattivi.",
      ].join("\n"),
    };
  }

  const strategy = await buildJoyStrategyInsight(
    { focus: "revenue" },
    options.userId
  );
  return {
    horizon: "monthly",
    summaryText: [
      "**Piano commerciale mensile (stime CRM)**",
      "",
      formatStrategyInsight(strategy),
    ].join("\n"),
  };
}
