/**
 * Proactive intervention engine — Joy initiates, never asks "Cosa vuoi fare?".
 * Driven by hour-of-day + CRM aggregates + proposals.
 */

import type { JoyCommercialProposal } from "@/features/joy/chat/services/joy-commercial-proposals.service";
import type {
  JoyOsObserveContext,
  JoyProactiveIntervention,
  JoyProactiveKind,
} from "../types";

function hourBucket(hour: number): "morning" | "midday" | "afternoon" | "evening" {
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 17) return "afternoon";
  return "evening";
}

function proposalToIntervention(
  proposal: JoyCommercialProposal,
  index: number
): JoyProactiveIntervention {
  const kindMap: Record<JoyCommercialProposal["kind"], JoyProactiveKind> = {
    urgent_follow_up: "urgent_follow_up",
    client_call: "urgent_follow_up",
    quote_followup: "forgotten_quote",
    stale_opportunity: "stale_opportunity",
    nearby_visit: "nearby_client",
    prospect: "new_client",
    sample_recovery: "inactive_client",
    open_order: "forgotten_quote",
    open_ticket: "urgent_follow_up",
  };

  const urgency: JoyProactiveIntervention["urgency"] =
    proposal.priority >= 85 ? "high" : proposal.priority >= 65 ? "medium" : "low";

  const suggestedPrompt =
    proposal.companyName &&
    (proposal.kind === "urgent_follow_up" || proposal.kind === "client_call")
      ? `Prepara chiamata ${proposal.companyName}`
      : proposal.companyName
        ? `Briefing ${proposal.companyName}`
        : "Cosa mi consigli di fare adesso?";

  return {
    id: `proactive-${proposal.kind}-${proposal.companyId ?? index}`,
    kind: kindMap[proposal.kind] ?? "coach_nudge",
    urgency,
    title: proposal.text.replace(/\*\*/g, "").slice(0, 80),
    message: `Ti consiglio questo: ${proposal.text.replace(/\*\*/g, "")}`,
    suggestedPrompt,
    score: proposal.priority,
    companyId: proposal.companyId ?? null,
    companyName: proposal.companyName ?? null,
  };
}

export function buildProactiveInterventions(input: {
  context: JoyOsObserveContext;
  proposals: JoyCommercialProposal[];
  summary?: {
    agendaItems?: number;
    overdueFollowUps?: number;
    visitsToday?: number;
    openOpportunities?: number;
  };
}): JoyProactiveIntervention[] {
  const hour = input.context.hour ?? new Date().getHours();
  const bucket = hourBucket(hour);
  const interventions: JoyProactiveIntervention[] = [];
  const summary = input.summary ?? {};

  if (bucket === "morning") {
    interventions.push({
      id: "proactive-morning-plan",
      kind: "morning_plan",
      urgency: "high",
      title: "Piano del mattino",
      message:
        "Ti consiglio di iniziare la giornata: briefing, follow-up scaduti e giro.",
      suggestedPrompt: "Inizia la giornata",
      score: 92,
    });
  }

  if (bucket === "midday") {
    interventions.push({
      id: "proactive-midday",
      kind: "midday_adjust",
      urgency: "medium",
      title: "Ricalibrazione di metà giornata",
      message:
        "Ti consiglio di ricalibrare priorità: cosa resta, chi è vicino, follow-up urgenti.",
      suggestedPrompt: "Cosa mi consigli di fare adesso?",
      score: 70,
    });
  }

  if (bucket === "evening") {
    interventions.push({
      id: "proactive-eod",
      kind: "evening_eod",
      urgency: "medium",
      title: "Chiusura giornata",
      message:
        "Ti consiglio il riepilogo di fine giornata: visite, follow-up e pipeline.",
      suggestedPrompt: "Riepiloga la mia giornata",
      score: 75,
    });
  }

  if ((summary.overdueFollowUps ?? 0) > 0) {
    interventions.push({
      id: "proactive-overdue-fu",
      kind: "urgent_follow_up",
      urgency: "high",
      title: `${summary.overdueFollowUps} follow-up in ritardo`,
      message: `Ti consiglio di recuperare i ${summary.overdueFollowUps} follow-up scaduti prima di altro.`,
      suggestedPrompt: "Quali follow-up sono in ritardo?",
      score: 95,
    });
  }

  if ((summary.agendaItems ?? 0) === 0 && bucket !== "evening") {
    interventions.push({
      id: "proactive-empty-agenda",
      kind: "free_time",
      urgency: "medium",
      title: "Agenda libera",
      message:
        "Ti consiglio di iniziare la giornata: Joy propone 3–5 visite dai dati CRM (da confermare).",
      suggestedPrompt: "Inizia la giornata",
      score: 78,
    });
  }

  for (const [index, proposal] of input.proposals.slice(0, 6).entries()) {
    interventions.push(proposalToIntervention(proposal, index));
  }

  const seen = new Set<string>();
  return interventions
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 5);
}

/** Chip strings for UI suggestion bars — always advisory. */
export function proactiveChipsFromInterventions(
  interventions: JoyProactiveIntervention[],
  limit = 6
): string[] {
  const chips = interventions.map((item) => item.suggestedPrompt);
  const unique = [...new Set(chips)];
  if (unique.length === 0) {
    return [
      "Inizia la giornata",
      "Ti consiglio le priorità di oggi",
      "Coach commerciale",
      "Ho due ore libere",
    ].slice(0, limit);
  }
  return unique.slice(0, limit);
}
