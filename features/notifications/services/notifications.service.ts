import "server-only";

import { cache } from "react";
import { listFollowUps } from "@/features/activities/services/follow-ups.service";
import { listOpportunities } from "@/features/opportunities/services/opportunities.service";
import { listQuotes } from "@/features/quotes/services/quotes.service";
import { listSamples } from "@/features/samples/services/samples.service";
import { listServiceTickets } from "@/features/service/services/service-tickets.service";
import { isOpenOpportunityStage } from "@/lib/constants/opportunity-pipeline";

export type NotificationSeverity = "high" | "medium" | "low";

export type NotificationCategory =
  | "follow_up"
  | "opportunity"
  | "quote"
  | "sample"
  | "service";

export interface IntelligentNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  description: string;
  href: string;
}

export interface IntelligentNotificationsResult {
  notifications: IntelligentNotification[];
  counts: { high: number; medium: number; low: number; total: number };
  error: string | null;
}

const STALE_OPPORTUNITY_DAYS = 21;
const STALE_QUOTE_DAYS = 14;

function daysSince(iso: string | null): number | null {
  if (!iso) {
    return null;
  }
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isPastDate(iso: string | null): boolean {
  if (!iso) {
    return false;
  }
  return new Date(iso).getTime() < Date.now();
}

export const getIntelligentNotifications = cache(
  async (): Promise<IntelligentNotificationsResult> => {
    const notifications: IntelligentNotification[] = [];
    const errors: string[] = [];

    const [followUpsResult, opportunitiesResult, quotesResult, samplesResult, ticketsResult] =
      await Promise.all([
        listFollowUps({ period: "overdue", limit: 50 }),
        listOpportunities({ limit: 500 }),
        listQuotes({ filters: { status: "sent" }, limit: 200 }),
        listSamples({ limit: 300 }),
        listServiceTickets({ limit: 300 }),
      ]);

    if (followUpsResult.error) errors.push(followUpsResult.error);
    if (opportunitiesResult.error) errors.push(opportunitiesResult.error);
    if (quotesResult.error) errors.push(quotesResult.error);
    if (samplesResult.error) errors.push(samplesResult.error);
    if (ticketsResult.error) errors.push(ticketsResult.error);

    for (const followUp of followUpsResult.data ?? []) {
      const late = daysSince(followUp.effective_at);
      notifications.push({
        id: `followup-${followUp.id}`,
        category: "follow_up",
        severity: "high",
        title: `Follow-up in ritardo · ${followUp.company_name ?? "Azienda"}`,
        description: late != null ? `Scaduto da ${late} giorni` : "Follow-up scaduto",
        href: followUp.company_id
          ? `/companies/${followUp.company_id}`
          : "/activities?section=followups&fperiod=overdue",
      });
    }

    for (const opportunity of opportunitiesResult.data ?? []) {
      if (!isOpenOpportunityStage(opportunity.stage)) {
        continue;
      }
      const idle = daysSince(opportunity.updated_at);
      if (idle != null && idle >= STALE_OPPORTUNITY_DAYS) {
        notifications.push({
          id: `opp-${opportunity.id}`,
          category: "opportunity",
          severity: idle >= STALE_OPPORTUNITY_DAYS * 2 ? "high" : "medium",
          title: `Opportunità ferma · ${opportunity.title}`,
          description: `${opportunity.company_name ?? "Azienda"} · nessun aggiornamento da ${idle} giorni`,
          href: `/opportunities/${opportunity.id}`,
        });
      }
    }

    for (const quote of quotesResult.data ?? []) {
      const waiting = daysSince(quote.sent_at ?? quote.updated_at);
      if (waiting != null && waiting >= STALE_QUOTE_DAYS) {
        notifications.push({
          id: `quote-${quote.id}`,
          category: "quote",
          severity: "medium",
          title: `Preventivo in attesa · ${quote.company_name ?? "Azienda"}`,
          description: `Inviato da ${waiting} giorni senza risposta`,
          href: `/preventivi/${quote.id}`,
        });
      }
    }

    for (const sample of samplesResult.data ?? []) {
      if (sample.status !== "consegnato") {
        continue;
      }
      if (isPastDate(sample.expected_return_at)) {
        const late = daysSince(sample.expected_return_at);
        notifications.push({
          id: `sample-${sample.id}`,
          category: "sample",
          severity: "medium",
          title: `Campione da rientrare · ${sample.company_name ?? "Azienda"}`,
          description:
            late != null
              ? `${sample.title} · rientro previsto ${late} giorni fa`
              : `${sample.title} · rientro previsto superato`,
          href: `/campioni/${sample.id}`,
        });
      }
    }

    for (const ticket of ticketsResult.data ?? []) {
      const isOpen = ticket.status !== "chiuso" && ticket.status !== "risolto";
      if (isOpen && ticket.priority === "high") {
        notifications.push({
          id: `ticket-${ticket.id}`,
          category: "service",
          severity: "high",
          title: `Assistenza urgente · ${ticket.company_name ?? "Azienda"}`,
          description: `${ticket.title} · priorità alta`,
          href: `/assistenza/${ticket.id}`,
        });
      }
    }

    const severityWeight = { high: 3, medium: 2, low: 1 };
    notifications.sort(
      (left, right) => severityWeight[right.severity] - severityWeight[left.severity]
    );

    const counts = {
      high: notifications.filter((item) => item.severity === "high").length,
      medium: notifications.filter((item) => item.severity === "medium").length,
      low: notifications.filter((item) => item.severity === "low").length,
      total: notifications.length,
    };

    return {
      notifications,
      counts,
      error: errors[0] ?? null,
    };
  }
);
