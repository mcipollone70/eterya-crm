/**
 * Central decision / scoring engine.
 * Converts CRM signals into ranked JoyOsDecision items (no mutations).
 * Every suggestion exposes action, reason, dataUsed, urgency, value, distance, time, confidence, missingData.
 */

import type { JoyCommercialProposal } from "@/features/joy/chat/services/joy-commercial-proposals.service";
import type { JoyCoachRecommendation } from "@/features/joy/tools/get-commercial-coach";
import type {
  JoyOsDecision,
  JoyDecisionKind,
  JoyDecisionUrgency,
  JoyDecisionConfidence,
  JoyDecisionStance,
} from "../types";

function proposalKindToDecision(kind: JoyCommercialProposal["kind"]): JoyDecisionKind {
  switch (kind) {
    case "urgent_follow_up":
    case "client_call":
      return "call";
    case "nearby_visit":
      return "visit";
    case "prospect":
      return "prospect";
    case "stale_opportunity":
      return "follow_up";
    case "quote_followup":
      return "quote_chase";
    case "sample_recovery":
      return "sample_recovery";
    case "open_order":
      return "follow_up";
    case "open_ticket":
      return "call";
    default:
      return "coach";
  }
}

function coachKindToDecision(kind: JoyCoachRecommendation["kind"]): JoyDecisionKind {
  switch (kind) {
    case "visit":
      return "visit";
    case "call":
      return "call";
    case "churn_risk":
    case "neglected":
      return "recover_lost";
    case "high_win":
      return "follow_up";
    case "prospect":
      return "prospect";
    case "deprioritize":
      return "coach";
    default:
      return "coach";
  }
}

function urgencyFromScore(score: number): JoyDecisionUrgency {
  if (score >= 90) return "critical";
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function confidenceFromSignals(
  dataUsed: string[],
  missingData: string[]
): JoyDecisionConfidence {
  if (dataUsed.length === 0) return "insufficient";
  if (missingData.length >= 2) return "low";
  if (missingData.length === 1) return "medium";
  return dataUsed.length >= 2 ? "high" : "medium";
}

function extractDistanceKm(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function actionForProposal(
  kind: JoyCommercialProposal["kind"],
  companyName: string | null | undefined
): string {
  const name = companyName?.trim();
  switch (kind) {
    case "urgent_follow_up":
    case "client_call":
      return name ? `Prepara chiamata ${name}` : "Quali follow-up sono in ritardo?";
    case "nearby_visit":
    case "prospect":
      return name ? `Briefing ${name}` : "Organizza giro visite";
    case "quote_followup":
      return "Preventivi da seguire";
    case "sample_recovery":
      return "Campioni da recuperare";
    case "stale_opportunity":
      return name ? `Coach commerciale su ${name}` : "Opportunità ferme";
    case "open_ticket":
      return name ? `Apri ${name}` : "Ticket assistenza aperti";
    default:
      return name ? `Briefing ${name}` : "Cosa mi consigli di fare adesso?";
  }
}

function dataUsedForProposal(kind: JoyCommercialProposal["kind"]): string[] {
  switch (kind) {
    case "urgent_follow_up":
    case "client_call":
      return ["follow_ups.status", "follow_ups.scheduled_at"];
    case "nearby_visit":
      return ["companies.latitude", "companies.longitude", "device.gps"];
    case "prospect":
      return ["companies.commercial_status"];
    case "stale_opportunity":
      return ["opportunities.stage", "opportunities.updated_at"];
    case "quote_followup":
      return ["quotes.status", "quotes.total_amount"];
    case "open_order":
      return ["orders.status", "orders.total_amount"];
    case "sample_recovery":
      return ["samples.status", "samples.days_overdue"];
    case "open_ticket":
      return ["service_tickets.status"];
    default:
      return ["crm.aggregate"];
  }
}

function missingForProposal(
  kind: JoyCommercialProposal["kind"],
  companyId?: string | null,
  distanceKm?: number | null
): string[] {
  const missing: string[] = [];
  if (!companyId && kind !== "quote_followup" && kind !== "open_order") {
    missing.push("companyId");
  }
  if ((kind === "nearby_visit" || kind === "prospect") && distanceKm == null) {
    missing.push("distanceKm");
  }
  return missing;
}

export function decisionsFromProposals(
  proposals: JoyCommercialProposal[]
): JoyOsDecision[] {
  return proposals.map((item, index) => {
    const reason = item.text.replace(/\*\*/g, "");
    const distanceKm = extractDistanceKm(reason);
    const dataUsed = dataUsedForProposal(item.kind);
    const missingData = missingForProposal(item.kind, item.companyId, distanceKm);
    const score = Math.min(100, Math.max(0, item.priority));
    const stance: JoyDecisionStance = "recommend";

    return {
      id: `prop-${item.kind}-${item.companyId ?? index}`,
      kind: proposalKindToDecision(item.kind),
      action: actionForProposal(item.kind, item.companyName),
      title: reason.slice(0, 120),
      reason,
      dataUsed,
      urgency: urgencyFromScore(score),
      commercialValueEur: null,
      distanceKm,
      timeHint: distanceKm != null ? `~${Math.max(10, Math.round(distanceKm * 2 + 20))} min stima strada+visita` : null,
      estimatedMinutes: distanceKm != null ? Math.max(20, Math.round(distanceKm * 2 + 25)) : null,
      confidence: confidenceFromSignals(dataUsed, missingData),
      missingData,
      stance,
      score,
      companyId: item.companyId ?? null,
      companyName: item.companyName ?? null,
      impactEstimate: `Priorità ${score}/100 — stima operativa da segnali CRM, non promessa.`,
    };
  });
}

export function decisionsFromCoach(
  recommendations: JoyCoachRecommendation[]
): JoyOsDecision[] {
  return recommendations.map((item, index) => {
    const score = Math.min(100, Math.max(0, item.score));
    const isDiscourage = item.kind === "deprioritize";
    const dataUsed = ["coach.crm_signals", item.kind];
    const missingData: string[] = [];
    if (!item.companyId) missingData.push("companyId");

    return {
      id: `coach-${item.kind}-${item.companyId ?? index}`,
      kind: coachKindToDecision(item.kind),
      action: isDiscourage
        ? `Non inseguire oggi ${item.companyName ?? item.title}`
        : item.companyName
          ? `Briefing ${item.companyName}`
          : item.title,
      title: item.title,
      reason: item.reason,
      dataUsed,
      urgency: isDiscourage ? "low" : urgencyFromScore(score),
      commercialValueEur: null,
      distanceKm: null,
      timeHint: item.estimatedMinutes != null ? `~${item.estimatedMinutes} min` : null,
      estimatedMinutes: item.estimatedMinutes ?? null,
      confidence: confidenceFromSignals(dataUsed, missingData),
      missingData,
      stance: isDiscourage ? "discourage" : "recommend",
      score: isDiscourage ? Math.min(score, 35) : score,
      companyId: item.companyId ?? null,
      companyName: item.companyName ?? null,
      impactEstimate: isDiscourage
        ? "Non te lo consiglio oggi — segnale coach su opportunità stale / basso ritorno."
        : `Score coach ${score} — stima, non garanzia.`,
    };
  });
}

/**
 * Merge + dedupe decisions by company+kind, keep highest score.
 * Discourage stance wins when same company has both recommend and discourage.
 */
export function mergeJoyDecisions(
  ...groups: JoyOsDecision[][]
): JoyOsDecision[] {
  const map = new Map<string, JoyOsDecision>();
  for (const group of groups) {
    for (const decision of group) {
      const key = `${decision.kind}:${decision.companyId ?? decision.title}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, decision);
        continue;
      }
      if (decision.stance === "discourage" && existing.stance !== "discourage") {
        map.set(key, decision);
        continue;
      }
      if (existing.stance === "discourage" && decision.stance !== "discourage") {
        continue;
      }
      if (decision.score > existing.score) {
        map.set(key, decision);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}

export function topDecisionNarrative(decisions: JoyOsDecision[]): string {
  if (decisions.length === 0) {
    return "Dai dati CRM attuali non emergono priorità urgenti. Ti consiglio di preparare la giornata o organizzare un giro.";
  }
  const top = decisions[0];
  if (top.stance === "discourage") {
    return `Non te lo consiglio: **${top.title}**. ${top.reason} (dati: ${top.dataUsed.join(", ") || "n/d"}).`;
  }
  const evidence =
    top.dataUsed.length > 0 ? ` Dati usati: ${top.dataUsed.join(", ")}.` : "";
  const missing =
    top.missingData.length > 0
      ? ` Dati mancanti: ${top.missingData.join(", ")}.`
      : "";
  return `Ti consiglio questo: **${top.title}**. ${top.reason}${evidence}${missing}`;
}

export function formatDecisionTransparency(decision: JoyOsDecision): string {
  const lines = [
    `**${decision.title}**`,
    `Azione: «${decision.action}»`,
    `Motivo: ${decision.reason}`,
    `Urgenza: ${decision.urgency} · Confidenza: ${decision.confidence} · Stance: ${decision.stance}`,
    `Dati usati: ${decision.dataUsed.join(", ") || "n/d"}`,
  ];
  if (decision.commercialValueEur != null) {
    lines.push(
      `Valore commerciale stimato (non promessa): € ${Math.round(decision.commercialValueEur).toLocaleString("it-IT")}`
    );
  }
  if (decision.distanceKm != null) {
    lines.push(`Distanza: ${decision.distanceKm.toFixed(1)} km`);
  }
  if (decision.timeHint) {
    lines.push(`Tempo: ${decision.timeHint}`);
  }
  if (decision.missingData.length > 0) {
    lines.push(`Dati mancanti: ${decision.missingData.join(", ")}`);
  }
  if (decision.impactEstimate) {
    lines.push(decision.impactEstimate);
  }
  return lines.join("\n");
}

export function buildRecommendedPrompt(decisions: JoyOsDecision[]): string {
  const actionable = decisions.find((d) => d.stance !== "discourage");
  if (!actionable) {
    return "Prepara la mia giornata";
  }
  return actionable.action || "Cosa mi consigli di fare adesso?";
}
