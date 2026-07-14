import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";
import type { FollowUpListItem } from "@/features/activities/services/follow-ups.service";
import type { OpportunityListItem } from "@/features/opportunities/services/opportunities.service";
import type { VisitListItem } from "@/features/visits/services/visits.service";
import { isOpenOpportunityStage } from "@/lib/constants/opportunity-pipeline";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import type {
  JoyDayPlanItem,
  JoyInsight,
  JoyOpportunityGroup,
  JoyRiskItem,
} from "../types/joy-data";

const STALE_OPPORTUNITY_DAYS = 30;

function formatTimeLabel(value: string): string {
  return new Date(value).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysSince(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const diff = Date.now() - new Date(value).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function buildJoyRecommendations(suggestions: DailyVisitSuggestion[]): JoyInsight[] {
  const items: JoyInsight[] = suggestions.map((suggestion) => {
    let icon: JoyInsight["icon"] = "target";
    let href = `/assistant?briefing=${suggestion.companyId}`;
    let actionLabel = "Briefing AI";

    if (suggestion.signals.hasOverdueFollowUp) {
      icon = "calendar";
      href = `/activities?section=followups&fcompany=${suggestion.companyId}`;
      actionLabel = "Gestisci follow-up";
    } else if (suggestion.signals.openOpportunityCount > 0) {
      icon = "flame";
      href = `/opportunities`;
      actionLabel = "Vedi opportunità";
    } else if (suggestion.signals.distanceKm != null && suggestion.signals.distanceKm <= 10) {
      icon = "map-pin";
      href = `/visits?company=${suggestion.companyId}&briefing=${suggestion.companyId}`;
      actionLabel = "Apri briefing";
    } else if (!suggestion.signals.daysSinceLastVisit) {
      icon = "sparkles";
      actionLabel = "Pianifica visita";
      href = `/visits?company=${suggestion.companyId}`;
    }

    return {
      id: `rec-${suggestion.companyId}`,
      icon,
      title: `Visita ${suggestion.companyName}`,
      explanation: suggestion.reasons.join(" · "),
      href,
      actionLabel,
      priority: suggestion.score,
    };
  });

  return items.sort((left, right) => right.priority - left.priority).slice(0, 10);
}

export function buildJoyRisks(input: {
  overdueFollowUps: FollowUpListItem[];
  opportunities: OpportunityListItem[];
  suggestions: DailyVisitSuggestion[];
  overdueVisits: VisitListItem[];
}): JoyRiskItem[] {
  const risks: JoyRiskItem[] = [];

  for (const followUp of input.overdueFollowUps.slice(0, 6)) {
    risks.push({
      id: `risk-followup-${followUp.id}`,
      title: `Follow-up scaduto · ${followUp.company_name ?? "Azienda"}`,
      explanation: `${followUp.activity_type}${followUp.description ? ` · ${followUp.description}` : ""}`,
      href: `/activities?section=followups&fcompany=${followUp.company_id}`,
      severity: followUp.priority === "high" ? "high" : "medium",
    });
  }

  for (const opportunity of input.opportunities) {
    if (!isOpenOpportunityStage(opportunity.stage)) {
      continue;
    }
    const idleDays = daysSince(opportunity.updated_at);
    if (idleDays == null || idleDays < STALE_OPPORTUNITY_DAYS) {
      continue;
    }
    risks.push({
      id: `risk-opp-${opportunity.id}`,
      title: `Opportunità ferma · ${opportunity.title}`,
      explanation: `${opportunity.company_name ?? "Azienda"} · ferma da ${idleDays} giorni`,
      href: `/opportunities`,
      severity: idleDays >= 45 ? "high" : "medium",
    });
    if (risks.length >= 12) {
      break;
    }
  }

  for (const suggestion of input.suggestions) {
    if (suggestion.commercialStatus !== "cliente") {
      continue;
    }
    const days = suggestion.signals.daysSinceLastVisit;
    if (days == null || days < 90) {
      continue;
    }
    risks.push({
      id: `risk-inactive-${suggestion.companyId}`,
      title: `Cliente inattivo · ${suggestion.companyName}`,
      explanation: `Ultima visita ${days} giorni fa`,
      href: `/visits?company=${suggestion.companyId}&briefing=${suggestion.companyId}`,
      severity: days >= 180 ? "high" : "medium",
    });
    if (risks.length >= 16) {
      break;
    }
  }

  for (const visit of input.overdueVisits.slice(0, 6)) {
    risks.push({
      id: `risk-visit-${visit.id}`,
      title: `Visita mancante · ${visit.company_name ?? "Azienda"}`,
      explanation: `Pianificata il ${new Date(visit.scheduled_at).toLocaleDateString("it-IT")}`,
      href: companyRegisterVisitHref(visit.company_id),
      severity: "high",
    });
  }

  return risks
    .sort((left, right) => (left.severity === right.severity ? 0 : left.severity === "high" ? -1 : 1))
    .slice(0, 12);
}

export function buildJoyOpportunities(input: {
  suggestions: DailyVisitSuggestion[];
  productFamilyCompanies: Record<"vepa" | "zanzariere" | "tapparelle", Array<{ id: string; name: string; city: string | null }>>;
}): JoyOpportunityGroup[] {
  const groups: JoyOpportunityGroup[] = [];

  const nearbyProspects = input.suggestions
    .filter(
      (item) =>
        item.commercialStatus === "prospect" &&
        item.signals.distanceKm != null &&
        item.signals.distanceKm <= 15
    )
    .slice(0, 8)
    .map((item) => ({ id: item.companyId, name: item.companyName, city: item.city }));

  if (nearbyProspects.length > 0) {
    groups.push({
      id: "nearby-prospects",
      title: "Prospect vicini",
      explanation: "Aziende prospect entro 15 km dalla tua area operativa.",
      companies: nearbyProspects,
      href: "/maps",
    });
  }

  const highPotential = input.suggestions
    .filter((item) => item.tier === "high" || item.score >= 75)
    .slice(0, 8)
    .map((item) => ({ id: item.companyId, name: item.companyName, city: item.city }));

  if (highPotential.length > 0) {
    groups.push({
      id: "high-potential",
      title: "Clienti ad alto potenziale",
      explanation: "Priorità commerciale elevata secondo Joy AI.",
      companies: highPotential,
      href: "/companies?sort=priority",
    });
  }

  const neverVisited = input.suggestions
    .filter((item) => item.signals.daysSinceLastVisit == null)
    .slice(0, 8)
    .map((item) => ({ id: item.companyId, name: item.companyName, city: item.city }));

  if (neverVisited.length > 0) {
    groups.push({
      id: "never-visited",
      title: "Aziende senza visite",
      explanation: "Mai visitate: ottime per nuove aperture commerciali.",
      companies: neverVisited,
      href: "/companies?last_visit=never",
    });
  }

  const familyLabels: Record<"vepa" | "zanzariere" | "tapparelle", string> = {
    vepa: "Interesse VEPA",
    zanzariere: "Interesse zanzariere",
    tapparelle: "Interesse tapparelle",
  };

  for (const family of ["vepa", "zanzariere", "tapparelle"] as const) {
    const companies = input.productFamilyCompanies[family];
    if (companies.length === 0) {
      continue;
    }
    groups.push({
      id: `family-${family}`,
      title: `Aziende interessate a ${familyLabels[family].replace("Interesse ", "")}`,
      explanation: `${companies.length} aziende con interesse prodotto registrato.`,
      companies: companies.slice(0, 8),
      href: `/companies?product_family=${family}`,
    });
  }

  return groups;
}

export function buildJoyDayPlan(
  visits: VisitListItem[],
  companyDetails: Map<
    string,
    {
      phone: string | null;
      latitude: number | null;
      longitude: number | null;
    }
  >
): JoyDayPlanItem[] {
  return visits
    .filter((visit) => visit.status === "scheduled" || visit.status === "in_progress")
    .sort((left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime())
    .map((visit) => {
      const details = companyDetails.get(visit.company_id);
      return {
        visitId: visit.id,
        companyId: visit.company_id,
        companyName: visit.company_name ?? "Azienda",
        city: visit.company_city,
        province: visit.company_province,
        scheduledAt: visit.scheduled_at,
        scheduledLabel: formatTimeLabel(visit.scheduled_at),
        status: visit.status,
        phone: details?.phone ?? null,
        latitude: details?.latitude ?? null,
        longitude: details?.longitude ?? null,
        notes: visit.notes,
      };
    });
}
