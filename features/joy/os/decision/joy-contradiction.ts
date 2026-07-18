/**
 * Contradiction engine — Joy can say "Non te lo consiglio" with data reasons.
 * Agent may override; overrides are recorded in day-ops memory (client).
 */

import type { JoyOsDecision } from "../types";

export interface JoyContradiction {
  id: string;
  decisionId: string;
  companyId?: string | null;
  companyName?: string | null;
  headline: string;
  reasons: string[];
  dataUsed: string[];
  missingData: string[];
  /** Prompt if agent insists */
  overridePrompt: string;
  confidence: JoyOsDecision["confidence"];
}

export function buildContradictionFromDecision(
  decision: JoyOsDecision
): JoyContradiction | null {
  if (decision.stance !== "discourage" && decision.stance !== "caution") {
    return null;
  }

  const reasons = [
    decision.reason,
    decision.impactEstimate,
    decision.missingData.length > 0
      ? `Dati mancanti: ${decision.missingData.join(", ")}`
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    id: `contradict-${decision.id}`,
    decisionId: decision.id,
    companyId: decision.companyId ?? null,
    companyName: decision.companyName ?? null,
    headline: `Non te lo consiglio: ${decision.title}`,
    reasons,
    dataUsed: decision.dataUsed,
    missingData: decision.missingData,
    overridePrompt: decision.companyName
      ? `Forza comunque: briefing ${decision.companyName}`
      : "Forza comunque: prosegui come ho detto",
    confidence: decision.confidence,
  };
}

/**
 * Evaluate a free-text agent request against ranked decisions.
 * If the request targets a discouraged company/kind, return contradiction.
 */
export function evaluateAgentOverrideRequest(
  message: string,
  decisions: JoyOsDecision[]
): JoyContradiction | null {
  const text = message.trim().toLowerCase();
  if (!text) return null;

  const discouraged = decisions.filter(
    (d) => d.stance === "discourage" || d.stance === "caution"
  );
  for (const decision of discouraged) {
    const name = decision.companyName?.toLowerCase();
    if (name && name.length > 2 && text.includes(name)) {
      return buildContradictionFromDecision(decision);
    }
  }
  return null;
}

export function formatContradiction(contradiction: JoyContradiction): string {
  return [
    `**${contradiction.headline}**`,
    "",
    ...contradiction.reasons.map((r) => `• ${r}`),
    "",
    `Dati usati: ${contradiction.dataUsed.join(", ") || "n/d"}`,
    contradiction.missingData.length > 0
      ? `Dati mancanti: ${contradiction.missingData.join(", ")}`
      : null,
    "",
    "Puoi forzare comunque (override agente). Dimmi esplicitamente di procedere.",
    `Esempio: «${contradiction.overridePrompt}»`,
  ]
    .filter((line) => line != null)
    .join("\n");
}

/** Soft heuristic: low score + far distance / missing company → caution */
export function applyCautionHeuristics(decisions: JoyOsDecision[]): JoyOsDecision[] {
  return decisions.map((decision) => {
    if (decision.stance === "discourage") return decision;
    const far =
      decision.distanceKm != null && decision.distanceKm > 40 && decision.score < 60;
    const thin =
      decision.confidence === "insufficient" ||
      (decision.missingData.includes("companyId") && decision.score < 50);
    if (!far && !thin) return decision;
    return {
      ...decision,
      stance: "caution" as const,
      reason: `${decision.reason} Attenzione: ${
        far ? "distanza elevata rispetto al potenziale" : "segnali CRM deboli"
      }.`,
      impactEstimate:
        "Non te lo consiglio come priorità — puoi forzare se hai contesto fuori CRM.",
    };
  });
}
