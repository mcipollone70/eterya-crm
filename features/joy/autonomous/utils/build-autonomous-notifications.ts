import type { GoogleCalendarConnectionView } from "@/lib/google-calendar/types";
import type { OpportunityRadarItem } from "@/features/radar/types";
import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";
import type { JoyRiskItem } from "../../types/joy-data";
import type { JoyAutonomousNotification } from "../types/joy-autonomous";

export function buildAutonomousNotifications(input: {
  suggestions: DailyVisitSuggestion[];
  risks: JoyRiskItem[];
  radarItems: OpportunityRadarItem[];
  neverVisitedCompanies: number;
  overdueFollowUps: number;
  calendar: GoogleCalendarConnectionView;
}): JoyAutonomousNotification[] {
  const notifications: JoyAutonomousNotification[] = [];

  if (input.neverVisitedCompanies > 0) {
    notifications.push({
      id: "notif-never-visited",
      kind: "no_visits",
      title: `${input.neverVisitedCompanies} aziende senza visite`,
      explanation: "Clienti e prospect mai visitati nel CRM.",
      severity: "medium",
      href: "/companies?last_visit=never",
    });
  }

  for (const suggestion of input.suggestions) {
    if (suggestion.signals.daysSinceLastVisit == null) {
      notifications.push({
        id: `notif-no-visit-${suggestion.companyId}`,
        kind: "no_visits",
        title: `Mai visitata · ${suggestion.companyName}`,
        explanation: suggestion.reasons.join(" · ") || "Nessuna visita registrata.",
        severity: "medium",
        companyId: suggestion.companyId,
        href: `/visits?company=${suggestion.companyId}&briefing=${suggestion.companyId}`,
      });
    }
  }

  for (const risk of input.risks) {
    if (risk.id.startsWith("risk-followup-")) {
      notifications.push({
        id: `notif-${risk.id}`,
        kind: "overdue_followup",
        title: risk.title,
        explanation: risk.explanation,
        severity: risk.severity === "high" ? "high" : "medium",
        href: risk.href,
      });
      continue;
    }

    if (risk.id.startsWith("risk-opp-")) {
      notifications.push({
        id: `notif-${risk.id}`,
        kind: "stale_opportunity",
        title: risk.title,
        explanation: risk.explanation,
        severity: risk.severity === "high" ? "high" : "medium",
        href: risk.href,
      });
      continue;
    }

    if (risk.id.startsWith("risk-visit-")) {
      notifications.push({
        id: `notif-${risk.id}`,
        kind: "reschedule_visit",
        title: risk.title,
        explanation: risk.explanation,
        severity: "high",
        href: risk.href,
      });
      continue;
    }

    if (risk.id.startsWith("risk-inactive-")) {
      notifications.push({
        id: `notif-${risk.id}`,
        kind: "no_visits",
        title: risk.title,
        explanation: risk.explanation,
        severity: risk.severity === "high" ? "high" : "medium",
        href: risk.href,
      });
    }
  }

  for (const item of input.radarItems.slice(0, 6)) {
    notifications.push({
      id: `notif-nearby-${item.companyId}`,
      kind: "nearby_company",
      title: `Vicino · ${item.companyName}`,
      explanation: `${item.distanceKm.toFixed(1)} km · ${item.primaryReason}`,
      severity: item.tier === "high" ? "high" : "medium",
      companyId: item.companyId,
      href: `/joy/autonomous?focus=${item.companyId}`,
    });
  }

  if (input.overdueFollowUps > 0) {
    notifications.push({
      id: "notif-followups-summary",
      kind: "overdue_followup",
      title: `${input.overdueFollowUps} follow-up in ritardo`,
      explanation: "Richiami e attività commerciali scadute.",
      severity: "high",
      href: "/activities?section=followups",
    });
  }

  if (input.calendar.configured && (!input.calendar.connected || input.calendar.needsReconnect)) {
    notifications.push({
      id: "notif-calendar",
      kind: "calendar_unsynced",
      title: "Google Calendar non sincronizzato",
      explanation: input.calendar.lastSyncError
        ? input.calendar.lastSyncError
        : "Collega o riconnetti il calendario dalle impostazioni.",
      severity: "medium",
      href: "/settings",
    });
  } else if (
    input.calendar.configured &&
    input.calendar.connected &&
    input.calendar.lastSyncError
  ) {
    notifications.push({
      id: "notif-calendar-error",
      kind: "calendar_unsynced",
      title: "Errore sincronizzazione calendario",
      explanation: input.calendar.lastSyncError,
      severity: "medium",
      href: "/settings",
    });
  }

  const seen = new Set<string>();
  return notifications
    .filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    })
    .sort((left, right) => {
      const weight = { high: 3, medium: 2, low: 1 };
      return weight[right.severity] - weight[left.severity];
    })
    .slice(0, 20);
}
