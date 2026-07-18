/**
 * Joy OS runtime — observe → reason → propose.
 * Single entry for proactive reasoning used by chat, suggestions, Command Center, autonomous.
 */

import "server-only";

import { buildUnifiedCommercialProposals } from "@/features/joy/chat/services/joy-commercial-proposals.service";
import { buildFreeTimeFill } from "@/features/joy/chat/services/joy-free-time-radar.service";
import { getJoyData } from "@/features/joy/services/joy-ai.service";
import {
  buildRecommendedPrompt,
  decisionsFromProposals,
  mergeJoyDecisions,
  topDecisionNarrative,
} from "./decision/joy-decision-engine";
import { applyCautionHeuristics } from "./decision/joy-contradiction";
import { buildProactiveInterventions } from "./suggestions/joy-proactive-engine";
import { runJoyCoaching } from "./coaching/joy-coaching";
import { runJoyPlanner } from "./planner/joy-planner";
import { buildSellMoreTodayPlan } from "./planner/joy-sell-more-today";
import { buildCommercialRadar } from "./radar/joy-commercial-radar";
import {
  buildJoyStrategyInsight,
  formatStrategyInsight,
} from "./strategy/joy-strategy-engine";
import { buildJoyAgentLearning } from "./learning/joy-learning-engine";
import {
  runJoySimulation,
  formatJoySimulation,
  type JoySimulationScenario,
} from "./simulations/joy-simulation-engine";
import { joySafeLog } from "./logging/joy-safe-logger";
import { JOY_OS_VERSION } from "./joy-os-version";
import type {
  JoyCommandCenterCard,
  JoyCommandCenterFreeTimeItem,
  JoyCommandCenterSnapshot,
  JoyCommandCenterStrategyChip,
  JoyOsDecision,
  JoyOsObserveContext,
  JoyOsReasoningResult,
  JoyOsTrigger,
  JoyStrategyRequest,
} from "./types";

async function safeJoySummary(): Promise<{
  agendaItems: number;
  overdueFollowUps: number;
  visitsToday: number;
  openOpportunities: number;
}> {
  try {
    const data = await getJoyData();
    return {
      agendaItems: data.summary.agendaItems,
      overdueFollowUps: data.summary.overdueFollowUps,
      visitsToday: data.summary.visitsToday,
      openOpportunities: data.summary.openOpportunities,
    };
  } catch {
    return {
      agendaItems: 0,
      overdueFollowUps: 0,
      visitsToday: 0,
      openOpportunities: 0,
    };
  }
}

function decisionToCard(decision: JoyOsDecision): JoyCommandCenterCard {
  return {
    id: decision.id,
    title: decision.title,
    action: decision.action,
    reason: decision.reason,
    urgency: decision.urgency,
    distanceKm: decision.distanceKm,
    timeHint: decision.timeHint ?? decision.impactEstimate ?? null,
    commercialValueEur: decision.commercialValueEur,
    companyId: decision.companyId,
    companyName: decision.companyName,
    href: decision.href,
    stance: decision.stance,
    explainPrompt: `Spiegami perché: ${decision.title}`,
  };
}

const STRATEGY_CHIPS: JoyCommandCenterStrategyChip[] = [
  { id: "revenue", label: "Come aumentare il fatturato?", prompt: "Come aumentare il fatturato" },
  { id: "sell-today", label: "Come vendiamo di più oggi?", prompt: "Come vendiamo di più oggi?" },
  { id: "zone", label: "Focus zona", prompt: "Strategia commerciale per zona" },
  { id: "lost", label: "Clienti persi", prompt: "Come recupero i clienti persi" },
  { id: "radar", label: "Radar commerciale", prompt: "Radar commerciale" },
  { id: "simulate", label: "Simula priorità", prompt: "Simula priorità VEPA" },
];

/**
 * Full OS reasoning cycle from CRM observation.
 */
export async function runJoyOsReasoning(
  context: JoyOsObserveContext
): Promise<JoyOsReasoningResult> {
  const trigger: JoyOsTrigger = context.trigger ?? "proactive_tick";
  const hour = context.hour ?? new Date().getHours();

  const [proposals, summary, coaching, radar] = await Promise.all([
    buildUnifiedCommercialProposals({
      userId: context.userId,
      latitude: context.latitude,
      longitude: context.longitude,
      limit: 12,
    }),
    safeJoySummary(),
    runJoyCoaching({
      userId: context.userId,
      includeLearning: trigger === "day_start" || trigger === "weekly",
      limit: 6,
    }),
    buildCommercialRadar({
      userId: context.userId,
      latitude: context.latitude,
      longitude: context.longitude,
    }).catch((error) => {
      joySafeLog("warn", "runtime", "radar failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }),
  ]);

  const proposalDecisions = applyCautionHeuristics(decisionsFromProposals(proposals));
  const decisions = mergeJoyDecisions(
    proposalDecisions,
    coaching.decisions,
    radar?.proposals ?? []
  );
  const interventions = buildProactiveInterventions({
    context: { ...context, hour },
    proposals,
    summary,
  });

  let strategy = null;
  let learning = null;

  if (trigger === "weekly" || trigger === "monthly" || trigger === "day_end") {
    strategy = await buildJoyStrategyInsight({ focus: "revenue" }, context.userId);
  }
  if (trigger === "day_start" || trigger === "weekly") {
    learning = await buildJoyAgentLearning(context.userId);
  }

  const narrative =
    interventions[0]?.message ??
    topDecisionNarrative(decisions) ??
    coaching.summaryText;

  return {
    phase: decisions.length > 0 ? "propose" : "observe",
    trigger,
    decisions: decisions.slice(0, 12),
    interventions: interventions.slice(0, 5),
    proposals,
    coach: undefined,
    strategy,
    learning,
    recommendedPrompt: buildRecommendedPrompt(decisions),
    narrative,
  };
}

/**
 * Strategy-only path for strategist questions.
 */
export async function runJoyOsStrategy(
  request: JoyStrategyRequest,
  userId: string | null
): Promise<{ insight: Awaited<ReturnType<typeof buildJoyStrategyInsight>>; text: string }> {
  const insight = await buildJoyStrategyInsight(request, userId);
  return { insight, text: formatStrategyInsight(insight) };
}

/**
 * Planner path for horizon-based plans.
 */
export async function runJoyOsPlan(options: {
  userId: string | null;
  companyId?: string | null;
  trigger?: JoyOsTrigger;
}) {
  return runJoyPlanner(options);
}

export async function runJoyOsSellMoreToday(options: {
  userId: string | null;
  latitude?: number | null;
  longitude?: number | null;
  freeMinutes?: number | null;
  cancelledVisitCount?: number;
  earlyFinish?: boolean;
}) {
  return buildSellMoreTodayPlan(options);
}

export async function runJoyOsRadar(options: {
  userId: string | null;
  latitude?: number | null;
  longitude?: number | null;
  freeMinutes?: number | null;
  cancelledVisitCount?: number;
  earlyFinish?: boolean;
}) {
  return buildCommercialRadar(options);
}

export async function runJoyOsCoach(options: {
  userId: string | null;
  includeLearning?: boolean;
  limit?: number;
}) {
  return runJoyCoaching(options);
}

export async function runJoyOsLearning(userId: string | null) {
  return buildJoyAgentLearning(userId);
}

export async function runJoyOsSimulation(
  scenario: JoySimulationScenario,
  userId: string | null
) {
  const result = await runJoySimulation(scenario, userId);
  return { result, text: formatJoySimulation(result) };
}

export async function runJoyOsFreeTime(options: {
  userId: string | null;
  freeMinutes: number;
  latitude?: number | null;
  longitude?: number | null;
}) {
  return buildFreeTimeFill(options);
}

/**
 * Command Center snapshot — parallel orchestrated engines, no CRM dump.
 */
export async function getJoyCommandCenterSnapshot(
  context: JoyOsObserveContext
): Promise<JoyCommandCenterSnapshot> {
  try {
    const [reasoning, freeTime, sellMore] = await Promise.all([
      runJoyOsReasoning({
        ...context,
        trigger: context.trigger ?? "day_start",
      }),
      runJoyOsFreeTime({
        userId: context.userId,
        freeMinutes: 120,
        latitude: context.latitude,
        longitude: context.longitude,
      }).catch((error) => {
        joySafeLog("warn", "runtime", "free-time failed", {
          error: error instanceof Error ? error.message : "unknown",
        });
        return null;
      }),
      runJoyOsSellMoreToday({
        userId: context.userId,
        latitude: context.latitude,
        longitude: context.longitude,
      }).catch((error) => {
        joySafeLog("warn", "runtime", "sell-more failed", {
          error: error instanceof Error ? error.message : "unknown",
        });
        return null;
      }),
    ]);

    const actionable = reasoning.decisions.filter((d) => d.stance !== "discourage");
    const adviceNow = actionable.slice(0, 3).map(decisionToCard);
    const prioritiesToday = actionable.slice(0, 5).map(decisionToCard);
    const nextDecision = actionable[0] ?? null;
    const nextAction = nextDecision ? decisionToCard(nextDecision) : null;

    const freeTimeItems: JoyCommandCenterFreeTimeItem[] = (freeTime?.items ?? [])
      .slice(0, 3)
      .map((item, index) => ({
        id: `ft-${index}-${item.companyId ?? item.kind}`,
        title: item.companyName
          ? `${item.kind === "call" ? "Chiama" : "Visita"} ${item.companyName}`
          : `Slot ${item.kind} (~${item.estimatedMinutes} min)`,
        reason: item.reason,
        estimatedMinutes: item.estimatedMinutes,
        companyId: item.companyId,
        companyName: item.companyName,
        prompt: item.companyName
          ? `Prepara ${item.kind === "call" ? "chiamata" : "visita"} ${item.companyName}`
          : "Ho due ore libere",
      }));

    const dayStartRecommendation =
      sellMore?.topActions[0]?.action ??
      nextAction?.action ??
      reasoning.recommendedPrompt;

    const syntheticParts = [
      adviceNow[0]?.title,
      freeTimeItems[0] ? `Tempo libero: ${freeTimeItems[0].title}` : null,
      nextAction ? `Prossima: ${nextAction.action}` : null,
    ].filter(Boolean);

    return {
      version: JOY_OS_VERSION,
      narrative: reasoning.narrative,
      syntheticSummary:
        syntheticParts.length > 0
          ? syntheticParts.slice(0, 2).join(" · ")
          : "Priorità e coaching Joy su dati CRM reali.",
      dayStart: {
        headline: sellMore?.headline ?? "Inizia la giornata",
        recommendation: dayStartRecommendation,
        followPrompt: dayStartRecommendation,
        organizePrompt: "Organizza il mio giro visite per oggi",
      },
      adviceNow,
      prioritiesToday,
      freeTime: freeTimeItems,
      nextAction,
      strategyChips: STRATEGY_CHIPS,
      recommendedPrompt: reasoning.recommendedPrompt,
      error: null,
    };
  } catch (error) {
    joySafeLog("error", "runtime", "command-center snapshot failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      version: JOY_OS_VERSION,
      narrative:
        "Non riesco a caricare il quadro operativo adesso. Riprova o parla con Joy.",
      syntheticSummary: "Joy temporaneamente non disponibile — riprova.",
      dayStart: {
        headline: "Inizia la giornata",
        recommendation: "Inizia la giornata",
        followPrompt: "Inizia la giornata",
        organizePrompt: "Organizza il mio giro visite per oggi",
      },
      adviceNow: [],
      prioritiesToday: [],
      freeTime: [],
      nextAction: null,
      strategyChips: STRATEGY_CHIPS,
      recommendedPrompt: "Inizia la giornata",
      error: error instanceof Error ? error.message : "Errore Command Center",
    };
  }
}

/**
 * When intent is unknown: never ask "Cosa vuoi fare?" — propose from OS.
 */
export async function buildJoyOsFallbackNarrative(
  context: JoyOsObserveContext
): Promise<{ narrative: string; recommendedPrompt: string }> {
  const reasoning = await runJoyOsReasoning({
    ...context,
    trigger: context.trigger ?? "proactive_tick",
  });

  const lines = [
    "Non ho mappato la frase a un comando preciso — ti consiglio comunque questo, dai dati CRM:",
    "",
    reasoning.narrative,
    "",
    reasoning.decisions.length > 0
      ? `Priorità top: ${reasoning.decisions
          .slice(0, 3)
          .map((d) => d.title)
          .join(" · ")}`
      : null,
    "",
    `Prossima mossa suggerita: «${reasoning.recommendedPrompt}».`,
  ].filter((line) => line != null);

  return {
    narrative: lines.join("\n"),
    recommendedPrompt: reasoning.recommendedPrompt,
  };
}
