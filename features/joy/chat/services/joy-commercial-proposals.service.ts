import "server-only";

import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import { createServerClient } from "@/lib/supabase/server";
import { getOpenServiceTickets } from "@/features/joy/tools/get-open-service-tickets";
import { getOrders } from "@/features/joy/tools/get-orders";
import { getQuotes } from "@/features/joy/tools/get-quotes";
import { getSamplesToRecover } from "@/features/joy/tools/get-samples-to-recover";
import { getStaleOpportunities } from "@/features/joy/tools/get-opportunities";

export type JoyProposalKind =
  | "urgent_follow_up"
  | "client_call"
  | "prospect"
  | "nearby_visit"
  | "stale_opportunity"
  | "quote_followup"
  | "open_order"
  | "sample_recovery"
  | "open_ticket";

export interface JoyCommercialProposal {
  kind: JoyProposalKind;
  priority: number;
  text: string;
  companyId?: string | null;
  companyName?: string | null;
}

function companyNameFromJoin(companies: unknown): string | null {
  const company = Array.isArray(companies) ? companies[0] : companies;
  return (company as { name?: string } | null)?.name ?? null;
}

/**
 * Pipeline proattiva unificata: aggrega follow-up, prospect, visite vicine,
 * opportunità stale, preventivi, ordini, campioni e ticket — solo dati CRM reali.
 */
export async function buildUnifiedCommercialProposals(options: {
  userId: string | null;
  latitude?: number | null;
  longitude?: number | null;
  limit?: number;
}): Promise<JoyCommercialProposal[]> {
  const { userId, latitude, longitude, limit = 10 } = options;
  const proposals: JoyCommercialProposal[] = [];
  const supabase = await createServerClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    overdueRes,
    callCandidatesRes,
    prospectsRes,
    staleRes,
    quotesRes,
    ordersRes,
    samplesRes,
    ticketsRes,
  ] = await Promise.all([
    (async () => {
      try {
        let query = supabase
          .from("follow_ups")
          .select("id,company_id,scheduled_at,description,companies(name)")
          .in("status", ["todo", "postponed"])
          .lt("scheduled_at", todayStart.toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(5);
        if (userId) query = query.eq("user_id", userId);
        return await query;
      } catch {
        return { data: null };
      }
    })(),
    (async () => {
      try {
        let query = supabase
          .from("follow_ups")
          .select("id,company_id,scheduled_at,activity_type,companies(name)")
          .in("status", ["todo", "postponed"])
          .gte("scheduled_at", todayStart.toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(8);
        if (userId) query = query.eq("user_id", userId);
        return await query;
      } catch {
        return { data: null };
      }
    })(),
    (async () => {
      try {
        let query = supabase
          .from("companies")
          .select("id,name,city,commercial_status,latitude,longitude,updated_at")
          .eq("commercial_status", "prospect")
          .order("updated_at", { ascending: false })
          .limit(8);
        if (userId) {
          const { applyAgentCompanyScope } = await import(
            "@/features/companies/utils/agent-company-scope"
          );
          query = applyAgentCompanyScope(query, userId);
        }
        return await query;
      } catch {
        return { data: null };
      }
    })(),
    getStaleOpportunities({ limit: 5 }),
    getQuotes({ limit: 8 }),
    getOrders({ limit: 8 }),
    getSamplesToRecover({ limit: 5 }),
    getOpenServiceTickets({ limit: 5 }),
  ]);

  for (const row of overdueRes.data ?? []) {
    const name = companyNameFromJoin(row.companies);
    proposals.push({
      kind: "urgent_follow_up",
      priority: 100,
      text: `Follow-up urgente: richiama **${name ?? "cliente"}** (scaduto).`,
      companyId: row.company_id,
      companyName: name,
    });
  }

  for (const row of callCandidatesRes.data ?? []) {
    const activity = String(
      (row as { activity_type?: string | null }).activity_type ?? ""
    ).toLowerCase();
    if (activity && !/call|telefon|richiam|phone/.test(activity)) {
      continue;
    }
    const name = companyNameFromJoin(row.companies);
    proposals.push({
      kind: "client_call",
      priority: 85,
      text: `Cliente da chiamare oggi: **${name ?? "n/d"}**.`,
      companyId: row.company_id,
      companyName: name,
    });
  }

  if (latitude != null && longitude != null) {
    const nearby = (prospectsRes.data ?? [])
      .filter((row) => row.latitude != null && row.longitude != null)
      .map((row) => ({
        ...row,
        km: getDistanceKm(latitude, longitude, row.latitude!, row.longitude!),
      }))
      .filter((row) => row.km <= 25)
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);

    for (const row of nearby) {
      proposals.push({
        kind: "nearby_visit",
        priority: 80 - Math.round(row.km),
        text: `Visita vicina: **${row.name}** a ${row.km.toFixed(1)} km${row.city ? ` (${row.city})` : ""}.`,
        companyId: row.id,
        companyName: row.name,
      });
    }
  }

  for (const row of (prospectsRes.data ?? []).slice(0, 3)) {
    if (proposals.some((p) => p.companyId === row.id && p.kind === "nearby_visit")) {
      continue;
    }
    proposals.push({
      kind: "prospect",
      priority: 55,
      text: `Prospect da coltivare: **${row.name}**${row.city ? ` (${row.city})` : ""}.`,
      companyId: row.id,
      companyName: row.name,
    });
  }

  if (staleRes.hasData && staleRes.data?.rows?.length) {
    for (const opp of staleRes.data.rows.slice(0, 3)) {
      proposals.push({
        kind: "stale_opportunity",
        priority: 75,
        text: `Opportunità ferma: **${opp.title}**${opp.companyName ? ` · ${opp.companyName}` : ""}.`,
        companyId: opp.companyId,
        companyName: opp.companyName,
      });
    }
  }

  if (quotesRes.hasData && quotesRes.data && quotesRes.data.quoteCount > 0) {
    const sample = quotesRes.data.recentQuotes?.[0];
    proposals.push({
      kind: "quote_followup",
      priority: 70,
      text: `Hai **${quotesRes.data.quoteCount} preventivi** da seguire${
        sample?.companyName ? ` (es. ${sample.companyName})` : ""
      }.`,
      companyName: sample?.companyName ?? null,
    });
  }

  if (ordersRes.hasData && ordersRes.data && ordersRes.data.orderCount > 0) {
    const sample = ordersRes.data.recentOrders[0];
    proposals.push({
      kind: "open_order",
      priority: 60,
      text: `Ordini aperti/recenti: **${ordersRes.data.orderCount}** (valore ${ordersRes.data.totalValue})${
        sample?.companyName ? ` · es. ${sample.companyName}` : ""
      }.`,
      companyName: sample?.companyName ?? null,
    });
  }

  if (samplesRes.hasData && samplesRes.data && samplesRes.data.count > 0) {
    const sample = samplesRes.data.samples[0];
    proposals.push({
      kind: "sample_recovery",
      priority: 78,
      text: `Campioni da recuperare: **${samplesRes.data.count}**${
        sample?.companyName ? ` (es. ${sample.companyName}, ${sample.daysOverdue}g)` : ""
      }.`,
      companyId: sample?.companyId,
      companyName: sample?.companyName,
    });
  }

  if (ticketsRes.hasData && ticketsRes.data && ticketsRes.data.count > 0) {
    const ticket = ticketsRes.data.tickets[0];
    proposals.push({
      kind: "open_ticket",
      priority: 72,
      text: `Ticket assistenza aperti: **${ticketsRes.data.count}**${
        ticket?.companyName ? ` (es. ${ticket.companyName})` : ""
      }.`,
      companyId: ticket?.companyId,
      companyName: ticket?.companyName,
    });
  }

  const seen = new Set<string>();
  return proposals
    .sort((a, b) => b.priority - a.priority)
    .filter((item) => {
      const key = `${item.kind}:${item.companyId ?? item.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function formatCommercialProposals(
  proposals: JoyCommercialProposal[]
): string {
  if (proposals.length === 0) {
    return "Al momento non ho priorità urgenti dai dati CRM. Posso organizzare un giro o preparare la giornata.";
  }
  const lines = proposals.map((item, index) => `${index + 1}. ${item.text}`);
  return [
    "**Priorità commerciali** (proposte, nessun salvataggio automatico):",
    "",
    ...lines,
    "",
    "Ti consiglio di partire dalla priorità 1. Dimmi: «organizza il giro», «briefing [cliente]», «Joy registra…».",
  ].join("\n");
}
