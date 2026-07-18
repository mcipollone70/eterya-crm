import "server-only";

import { listContactHistory } from "@/features/activities/services/contact-history.service";
import { listFollowUps } from "@/features/activities/services/follow-ups.service";
import { listOpportunities } from "@/features/opportunities/services/opportunities.service";
import { listOrders } from "@/features/orders/services/orders.service";
import { listQuotes } from "@/features/quotes/services/quotes.service";
import { listSamples } from "@/features/samples/services/samples.service";
import { listServiceTickets } from "@/features/service/services/service-tickets.service";
import { listVisitsByCompany } from "@/features/visits/services/visits.service";
import { CONTACT_HISTORY_TYPE_LABELS } from "@/lib/constants/contact-history";
import { FOLLOW_UP_STATUS_LABELS } from "@/lib/constants/follow-up";
import { OPPORTUNITY_STAGE_LABELS } from "@/lib/constants/opportunity-pipeline";
import { QUOTE_STATUS_LABELS } from "@/lib/constants/quotes";
import { ORDER_FULFILLMENT_STATUS_LABELS } from "@/lib/constants/orders";
import { SAMPLE_STATUS_LABELS } from "@/lib/constants/samples";
import { SERVICE_TICKET_STATUS_LABELS } from "@/lib/constants/service-tickets";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyTimelineEvent {
  id: string;
  at: string;
  kind: string;
  title: string;
  detail: string | null;
  href: string | null;
}

export interface JoyCompanyTimelineSnapshot {
  companyId: string;
  events: JoyTimelineEvent[];
  summaryText: string;
}

function sortByDateDesc(a: JoyTimelineEvent, b: JoyTimelineEvent): number {
  return new Date(b.at).getTime() - new Date(a.at).getTime();
}

export async function getCompanyTimeline(
  companyId: string,
  options?: { limit?: number }
): Promise<JoyToolResult<JoyCompanyTimelineSnapshot | null>> {
  const limit = options?.limit ?? 25;

  try {
    if (!companyId.trim()) {
      return emptyToolResult(null, "Azienda non specificata.");
    }

    const [
      historyResult,
      followUpsResult,
      quotesResult,
      ordersResult,
      samplesResult,
      ticketsResult,
      visitsResult,
      opportunitiesResult,
    ] = await Promise.all([
      listContactHistory({ companyId, limit: 40 }),
      listFollowUps({ companyId, limit: 20 }),
      listQuotes({ filters: { companyId }, limit: 20, includeWon: true }),
      listOrders({ filters: { companyId }, limit: 20 }),
      listSamples({ filters: { companyId }, limit: 20 }),
      listServiceTickets({ filters: { companyId }, limit: 20 }),
      listVisitsByCompany(companyId),
      listOpportunities({ companyId, limit: 20 }),
    ]);

    const hardError =
      historyResult.error ??
      followUpsResult.error ??
      quotesResult.error ??
      ordersResult.error ??
      samplesResult.error ??
      ticketsResult.error ??
      visitsResult.error ??
      opportunitiesResult.error;

    const events: JoyTimelineEvent[] = [];

    for (const item of historyResult.data ?? []) {
      events.push({
        id: `activity-${item.id}`,
        at: item.occurred_at,
        kind: "Attività",
        title: item.title,
        detail: CONTACT_HISTORY_TYPE_LABELS[item.type] ?? item.type,
        href: `/companies/${companyId}?tab=attivita`,
      });
    }

    for (const item of followUpsResult.data ?? []) {
      events.push({
        id: `followup-${item.id}`,
        at: item.effective_at || item.scheduled_at,
        kind: "Follow-up",
        title: item.description?.trim() || "Follow-up",
        detail: FOLLOW_UP_STATUS_LABELS[item.status],
        href: `/activities?section=followups&company=${companyId}`,
      });
    }

    for (const item of visitsResult.data ?? []) {
      events.push({
        id: `visit-${item.id}`,
        at: item.completed_at ?? item.scheduled_at ?? item.created_at,
        kind: "Visita",
        title: item.notes?.trim() || item.outcome?.trim() || "Visita commerciale",
        detail: item.status,
        href: `/visits?company=${companyId}`,
      });
    }

    for (const item of opportunitiesResult.data ?? []) {
      if (item.stage === "won" || item.status === "accepted") continue;
      events.push({
        id: `opportunity-${item.id}`,
        at: item.updated_at ?? item.opened_at ?? item.created_at,
        kind: "Opportunità",
        title: item.title,
        detail: OPPORTUNITY_STAGE_LABELS[item.stage] ?? item.stage,
        href: `/opportunities/${item.id}`,
      });
    }

    for (const item of quotesResult.data ?? []) {
      if (item.stage === "won") continue;
      events.push({
        id: `quote-${item.id}`,
        at: item.updated_at ?? item.opened_at ?? item.created_at,
        kind: "Preventivo",
        title: item.title,
        detail: QUOTE_STATUS_LABELS[item.status],
        href: `/preventivi/${item.id}`,
      });
    }

    for (const item of ordersResult.data ?? []) {
      events.push({
        id: `order-${item.id}`,
        at: item.order_date ?? item.accepted_at ?? item.updated_at ?? item.created_at,
        kind: "Ordine",
        title: item.title,
        detail: item.order_status
          ? ORDER_FULFILLMENT_STATUS_LABELS[item.order_status]
          : "Ordine",
        href: `/ordini/${item.id}`,
      });
    }

    for (const item of samplesResult.data ?? []) {
      events.push({
        id: `sample-${item.id}`,
        at: item.given_at,
        kind: "Campione",
        title: item.title,
        detail: SAMPLE_STATUS_LABELS[item.status],
        href: `/campioni/${item.id}`,
      });
    }

    for (const item of ticketsResult.data ?? []) {
      events.push({
        id: `ticket-${item.id}`,
        at: item.opened_at,
        kind: "Assistenza",
        title: item.title,
        detail: SERVICE_TICKET_STATUS_LABELS[item.status],
        href: `/assistenza/${item.id}`,
      });
    }

    events.sort(sortByDateDesc);
    const limited = events.slice(0, limit);

    if (limited.length === 0) {
      return successToolResult({
        companyId,
        events: [],
        summaryText: hardError
          ? `Timeline non completa: ${hardError}`
          : "Nessun evento commerciale recente per questa azienda.",
      });
    }

    const lines = limited.map((event) => {
      const dateLabel = new Date(event.at).toLocaleDateString("it-IT");
      return `• **${dateLabel}** · ${event.kind}: ${event.title}${
        event.detail ? ` (${event.detail})` : ""
      }`;
    });

    return successToolResult({
      companyId,
      events: limited,
      summaryText: `**Timeline commerciale** (${limited.length} eventi):\n${lines.join("\n")}`,
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare la timeline."
    );
  }
}
