/**
 * Coaching facade — wraps getCommercialCoach + learning patterns.
 */

import "server-only";

import { getCommercialCoach } from "@/features/joy/tools/get-commercial-coach";
import { JOY_INSUFFICIENT_DATA_MESSAGE } from "@/features/joy/tools";
import { buildJoyAgentLearning } from "../learning/joy-learning-engine";
import { decisionsFromCoach } from "../decision/joy-decision-engine";
import type { JoyOsDecision } from "../types";

export async function runJoyCoaching(options: {
  userId: string | null;
  includeLearning?: boolean;
  limit?: number;
}): Promise<{
  summaryText: string;
  decisions: JoyOsDecision[];
}> {
  const [coach, learning] = await Promise.all([
    getCommercialCoach({ userId: options.userId, limit: options.limit ?? 8 }),
    options.includeLearning !== false
      ? buildJoyAgentLearning(options.userId)
      : Promise.resolve(null),
  ]);

  if (!coach.hasData || !coach.data) {
    return {
      summaryText: coach.error ?? JOY_INSUFFICIENT_DATA_MESSAGE,
      decisions: [],
    };
  }

  const decisions = decisionsFromCoach(coach.data.recommendations);
  const parts = [coach.data.summaryText];

  if (learning) {
    const usable = learning.patterns.filter((p) => p.confidence !== "insufficient");
    if (usable.length > 0 || learning.inefficiencies.length > 0) {
      parts.push(
        "",
        "**Pattern agente (aggregati CRM):**",
        ...usable.slice(0, 3).map((p) => `• ${p.label}: ${p.finding}`),
        ...learning.inefficiencies.slice(0, 2).map((item) => `• Focus: ${item}`)
      );
    }
  }

  parts.push("", "Nessuna mutazione automatica — conferma ogni azione proposta.");

  return {
    summaryText: parts.join("\n"),
    decisions,
  };
}
