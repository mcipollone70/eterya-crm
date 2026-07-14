import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";
import type { OpportunityListItem } from "@/features/opportunities/services/opportunities.service";
import type { FollowUpListItem } from "@/features/activities/services/follow-ups.service";
import type { VisitListItem } from "@/features/visits/services/visits.service";
import type { JoyDayPlanItem } from "../../types/joy-data";
import type { JoyAutonomousDecision } from "../types/joy-autonomous";

function tomorrowMorningIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function inDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function impactLabel(score: number, detail: string): string {
  if (score >= 80) {
    return `Alto · ${detail}`;
  }
  if (score >= 55) {
    return `Medio · ${detail}`;
  }
  return `Basso · ${detail}`;
}

export function buildAutonomousDecisions(input: {
  suggestions: DailyVisitSuggestion[];
  dayPlan: JoyDayPlanItem[];
  overdueFollowUps: FollowUpListItem[];
  overdueVisits: VisitListItem[];
  opportunities: OpportunityListItem[];
  estimatedTourKm: number;
}): JoyAutonomousDecision[] {
  const decisions: JoyAutonomousDecision[] = [];

  for (const visit of input.overdueVisits.slice(0, 4)) {
    const scheduledAt = tomorrowMorningIso();
    decisions.push({
      id: `decision-reschedule-${visit.id}`,
      icon: "visit",
      title: `Ripianifica visita · ${visit.company_name ?? "Azienda"}`,
      motivation: `Visita mancata del ${new Date(visit.scheduled_at).toLocaleDateString("it-IT")}.`,
      estimatedImpact: impactLabel(90, "recupero appuntamento perso"),
      impactScore: 90,
      actionLabel: "Esegui",
      operation: {
        type: "update_visit",
        visitId: visit.id,
        companyId: visit.company_id,
        companyName: visit.company_name ?? "Azienda",
        scheduledAt,
      },
    });
  }

  for (const followUp of input.overdueFollowUps.slice(0, 4)) {
    decisions.push({
      id: `decision-followup-${followUp.id}`,
      icon: "follow_up",
      title: `Recupera follow-up · ${followUp.company_name ?? "Azienda"}`,
      motivation: followUp.description ?? `Follow-up ${followUp.activity_type} scaduto.`,
      estimatedImpact: impactLabel(
        followUp.priority === "high" ? 85 : 70,
        "cliente a rischio abbandono"
      ),
      impactScore: followUp.priority === "high" ? 85 : 70,
      actionLabel: "Esegui",
      operation: {
        type: "create_follow_up",
        companyId: followUp.company_id,
        companyName: followUp.company_name ?? "Azienda",
        scheduledAt: inDaysIso(1),
        description: followUp.description,
      },
    });
  }

  for (const suggestion of input.suggestions.slice(0, 6)) {
    const impactScore = suggestion.score;
    const pipelineDetail =
      suggestion.signals.openPipelineValue > 0
        ? `pipeline stimata +${formatOpportunityAmount(suggestion.signals.openPipelineValue)}`
        : "priorità commerciale elevata";

    if (suggestion.signals.hasOverdueFollowUp) {
      decisions.push({
        id: `decision-priority-fu-${suggestion.companyId}`,
        icon: "follow_up",
        title: `Follow-up urgente · ${suggestion.companyName}`,
        motivation: suggestion.reasons.join(" · "),
        estimatedImpact: impactLabel(impactScore + 10, pipelineDetail),
        impactScore: impactScore + 10,
        actionLabel: "Esegui",
        operation: {
          type: "create_follow_up",
          companyId: suggestion.companyId,
          companyName: suggestion.companyName,
          scheduledAt: inDaysIso(1),
        },
      });
      continue;
    }

    const hasVisitToday = input.dayPlan.some((item) => item.companyId === suggestion.companyId);
    if (!hasVisitToday) {
      decisions.push({
        id: `decision-visit-${suggestion.companyId}`,
        icon: "visit",
        title: `Pianifica visita · ${suggestion.companyName}`,
        motivation: suggestion.reasons.join(" · "),
        estimatedImpact: impactLabel(impactScore, pipelineDetail),
        impactScore,
        actionLabel: "Esegui",
        operation: {
          type: "create_visit",
          companyId: suggestion.companyId,
          companyName: suggestion.companyName,
          scheduledAt: tomorrowMorningIso(),
        },
      });
    } else {
      decisions.push({
        id: `decision-briefing-${suggestion.companyId}`,
        icon: "briefing",
        title: `Briefing · ${suggestion.companyName}`,
        motivation: suggestion.reasons.join(" · "),
        estimatedImpact: impactLabel(impactScore, "preparazione visita"),
        impactScore,
        actionLabel: "Esegui",
        href: `/joy/autonomous?focus=${suggestion.companyId}`,
      });
    }
  }

  if (input.dayPlan.length >= 2 && input.estimatedTourKm > 0) {
    decisions.push({
      id: "decision-route",
      icon: "route",
      title: "Organizza giro visite di oggi",
      motivation: `${input.dayPlan.length} tappe · ${input.estimatedTourKm.toFixed(1)} km stimati.`,
      estimatedImpact: impactLabel(75, "risparmio tempo sul campo"),
      impactScore: 75,
      actionLabel: "Esegui",
      operation: {
        type: "navigate",
        href: "/routes",
        label: "Giro Visite",
      },
    });
  }

  if (input.dayPlan.length > 0) {
    const next = input.dayPlan[0];
    decisions.push({
      id: `decision-agenda-${next.visitId}`,
      icon: "agenda",
      title: `Apri agenda · ${next.companyName}`,
      motivation: `Prossima visita alle ${next.scheduledLabel}.`,
      estimatedImpact: impactLabel(65, "sincronizzazione giornata"),
      impactScore: 65,
      actionLabel: "Esegui",
      operation: {
        type: "navigate",
        href: "/agenda",
        label: "Agenda",
      },
    });
  }

  const hotOpportunity = input.opportunities
    .filter((item) => item.probability != null && item.probability >= 70)
    .sort((left, right) => right.total_amount - left.total_amount)[0];

  if (hotOpportunity?.company_id) {
    decisions.push({
      id: `decision-opp-${hotOpportunity.id}`,
      icon: "call",
      title: `Opportunità calda · ${hotOpportunity.company_name ?? hotOpportunity.title}`,
      motivation: `${formatOpportunityAmount(hotOpportunity.total_amount)} · probabilità ${hotOpportunity.probability}%`,
      estimatedImpact: impactLabel(88, "chiusura potenziale"),
      impactScore: 88,
      actionLabel: "Esegui",
      href: `/companies/${hotOpportunity.company_id}`,
    });
  }

  const seen = new Set<string>();
  return decisions
    .filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    })
    .sort((left, right) => right.impactScore - left.impactScore)
    .slice(0, 12);
}
